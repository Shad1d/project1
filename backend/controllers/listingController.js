import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Listing from "../models/listing.js";
import User from "../models/user.js";
import {
    parseQueryIntent,
    calculateRelevanceScore,
    generateRagInsights,
} from "../utils/ragSearch.js";

// ── __dirname shim for ESM ────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Multer storage ────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, "../uploads/listings");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WEBP and GIF images are allowed"), false);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // 5 MB each, max 6
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const num = (v) => (v !== undefined && v !== "" ? Number(v) : undefined);
const bool = (v) => v === "true" || v === true;

const NEARBY_RADIUS_METERS = 20_000; // 20 km

// ── POST /api/listings ────────────────────────────────────────────────────────
export const createListing = async (req, res) => {
    try {
        const {
            listingType,
            title,
            category,
            condition,
            description,
            quantity,
            negotiable,
            deliveryAvailable,
            // sell
            price,
            // rent
            rentPricePerDay,
            depositAmount,
            minRentalDays,
            maxRentalDays,
            rentTerms,
        } = req.body;

        // ── Basic field validation ──────────────────────────────────────────────
        const missing = [];
        if (!title?.trim()) missing.push("title");
        if (!category) missing.push("category");
        if (!condition) missing.push("condition");
        if (!description?.trim()) missing.push("description");
        if (listingType === "sell" && !price) missing.push("price");
        if (listingType === "rent" && !rentPricePerDay) missing.push("rentPricePerDay");

        if (missing.length) {
            return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "At least one image is required." });
        }

        // ── Fetch seller's location (lean — only the field we need) ────────────
        // We intentionally snapshot the seller's current location onto the listing
        // so that geo queries run entirely on the Listing collection's 2dsphere
        // index without ever joining through the User collection at query time.
        const seller = await User.findById(req.user._id).select("location").lean();
        if (!seller?.location?.coordinates?.length) {
            return res.status(400).json({
                error: "Your account does not have a saved location. Please update your profile before listing.",
            });
        }

        // ── Build image array ───────────────────────────────────────────────────
        const images = req.files.map((f) => ({
            url: `/uploads/listings/${f.filename}`,
            filename: f.filename,
        }));

        // ── Create document ─────────────────────────────────────────────────────
        const listing = await Listing.create({
            seller: req.user._id,
            listingType,
            title: title.trim(),
            category,
            condition,
            description: description.trim(),
            quantity: num(quantity) ?? 1,
            negotiable: bool(negotiable),
            deliveryAvailable: bool(deliveryAvailable),
            images,
            // Always construct the GeoJSON object explicitly.
            // Never spread seller.location directly — if the user document was
            // saved before the schema fix, it may be missing the `type: "Point"`
            // discriminator, which would cause the 2dsphere index to reject it.
            location: {
                type: "Point",
                coordinates: seller.location.coordinates,
            },
            // sell
            ...(listingType === "sell" && { price: num(price) }),
            // rent
            ...(listingType === "rent" && {
                rentPricePerDay: num(rentPricePerDay),
                depositAmount: num(depositAmount) ?? 0,
                ...(minRentalDays && { minRentalDays: num(minRentalDays) }),
                ...(maxRentalDays && { maxRentalDays: num(maxRentalDays) }),
                rentTerms: rentTerms?.trim() || "",
            }),
        });

        return res.status(201).json({ message: "Listing created successfully.", listing });
    } catch (err) {
        if (req.files) {
            req.files.forEach((f) => fs.unlink(f.path, () => { }));
        }
        console.error("createListing error:", err);
        return res.status(500).json({ error: "Failed to create listing." });
    }
};

// ── GET /api/listings ─────────────────────────────────────────────────────────
export const getListings = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            listingType,
            condition,
            minPrice,
            maxPrice,
            search,
            status = "active",
        } = req.query;

        // Coerce early so arithmetic is always numeric
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 20); // cap at 100

        const filter = { status };
        if (category) filter.category = category;
        if (listingType) filter.listingType = listingType;
        if (condition) filter.condition = condition;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }
        if (search) filter.$text = { $search: search };

        const [listings, total] = await Promise.all([
            Listing.find(filter)
                // FIX: User schema uses firstName/lastName, not name
                .populate("seller", "firstName lastName email")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Listing.countDocuments(filter),
        ]);

        res.json({ listings, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error("getListings error:", err);
        res.status(500).json({ error: "Failed to fetch listings." });
    }
};

// ── GET /api/listings/search ──────────────────────────────────────────────────
// Full-featured Search API with RAG intent processing, Keyword matching,
// Category, Price, Distance, Delivery, and Seller verification filtering.
export const searchListings = async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            q,
            search,
            category,
            minPrice,
            maxPrice,
            lat,
            lng,
            maxDistance = 20,
            deliveryAvailable,
            sellerVerified,
            listingType,
            condition,
            sort = "relevance",
            page = 1,
            limit = 20,
        } = req.query;

        const queryTerm = (q || search || "").trim();
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

        // Parse query intent using RAG engine
        const intent = parseQueryIntent(queryTerm);

        // Build base match stage for Listing
        const matchStage = { status: "active" };

        if (listingType && listingType !== "all") {
            matchStage.listingType = listingType;
        } else if (intent.listingTypeHint) {
            matchStage.listingType = intent.listingTypeHint;
        }

        // Category filter
        const activeCategory = category || intent.extractedCategory;
        if (activeCategory && activeCategory !== "all") {
            matchStage.category = activeCategory;
        }

        // Condition filter
        if (condition && condition !== "all") {
            matchStage.condition = condition;
        }

        // Delivery filter
        if (deliveryAvailable === "true" || (intent.deliveryHint && deliveryAvailable !== "false")) {
            matchStage.deliveryAvailable = true;
        }

        // Price filter
        const activeMinPrice = minPrice ? Number(minPrice) : intent.minPriceHint;
        const activeMaxPrice = maxPrice ? Number(maxPrice) : intent.maxPriceHint;

        if (
            (activeMinPrice !== null && activeMinPrice !== undefined && !isNaN(activeMinPrice)) ||
            (activeMaxPrice !== null && activeMaxPrice !== undefined && !isNaN(activeMaxPrice))
        ) {
            const priceCond = {};
            if (activeMinPrice !== null && activeMinPrice !== undefined && !isNaN(activeMinPrice)) {
                priceCond.$gte = activeMinPrice;
            }
            if (activeMaxPrice !== null && activeMaxPrice !== undefined && !isNaN(activeMaxPrice)) {
                priceCond.$lte = activeMaxPrice;
            }

            matchStage.$or = [
                { price: priceCond },
                { rentPricePerDay: priceCond },
            ];
        }

        // Parse latitude and longitude for location / distance filtering
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const maxDistKm = parseFloat(maxDistance) || 20;
        const maxDistMeters = maxDistKm * 1000;

        const pipeline = [];

        // 1. GeoNear stage (if valid coordinates provided)
        const hasGeo = !isNaN(userLat) && !isNaN(userLng) && userLat !== null && userLng !== null;
        if (hasGeo) {
            pipeline.push({
                $geoNear: {
                    near: { type: "Point", coordinates: [userLng, userLat] },
                    distanceField: "distanceMeters",
                    maxDistance: maxDistMeters,
                    spherical: true,
                    query: matchStage,
                },
            });
        } else {
            pipeline.push({ $match: matchStage });
        }

        // 2. Lookup seller details
        pipeline.push(
            {
                $lookup: {
                    from: "users",
                    localField: "seller",
                    foreignField: "_id",
                    as: "sellerObj",
                },
            },
            {
                $unwind: {
                    path: "$sellerObj",
                    preserveNullAndEmptyArrays: true,
                },
            }
        );

        // 3. Seller verification filter
        const isVerifiedFilter = sellerVerified === "true" || (intent.verifiedHint && sellerVerified !== "false");
        if (isVerifiedFilter) {
            pipeline.push({
                $match: { "sellerObj.isEmailVerified": true },
            });
        }

        // 4. Keyword text search filtering if keyword provided
        if (queryTerm) {
            const regexTerms = intent.expandedTerms.map(
                (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
            );
            pipeline.push({
                $match: {
                    $or: [
                        { title: { $in: regexTerms } },
                        { description: { $in: regexTerms } },
                        { category: { $in: regexTerms } },
                    ],
                },
            });
        }

        // Execute aggregation pipeline to fetch candidates
        const allCandidates = await Listing.aggregate(pipeline);

        // Attach RAG relevance score & compute distance in km
        const scoredListings = allCandidates.map((doc) => {
            const distanceKm =
                doc.distanceMeters !== undefined
                    ? Math.round((doc.distanceMeters / 1000) * 10) / 10
                    : null;
            const score = calculateRelevanceScore(doc, intent);

            const seller = doc.sellerObj
                ? {
                      _id: doc.sellerObj._id,
                      firstName: doc.sellerObj.firstName,
                      lastName: doc.sellerObj.lastName,
                      email: doc.sellerObj.email,
                      isEmailVerified: !!doc.sellerObj.isEmailVerified,
                  }
                : null;

            delete doc.sellerObj;
            return {
                ...doc,
                seller,
                distanceKm,
                ragScore: score,
            };
        });

        // Sort results
        if (sort === "price_asc") {
            scoredListings.sort(
                (a, b) =>
                    (a.price ?? a.rentPricePerDay ?? 0) -
                    (b.price ?? b.rentPricePerDay ?? 0)
            );
        } else if (sort === "price_desc") {
            scoredListings.sort(
                (a, b) =>
                    (b.price ?? b.rentPricePerDay ?? 0) -
                    (a.price ?? a.rentPricePerDay ?? 0)
            );
        } else if (sort === "distance") {
            scoredListings.sort(
                (a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999)
            );
        } else if (sort === "newest") {
            scoredListings.sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
        } else {
            // Default "relevance": sort by RAG relevance score descending
            scoredListings.sort((a, b) => b.ragScore - a.ragScore);
        }

        // Pagination
        const total = scoredListings.length;
        const pages = Math.ceil(total / limitNum) || 1;
        const pagedListings = scoredListings.slice(
            (pageNum - 1) * limitNum,
            pageNum * limitNum
        );

        // Generate RAG search insights
        const appliedFilters = {
            category: activeCategory,
            minPrice: activeMinPrice,
            maxPrice: activeMaxPrice,
            maxDistance: hasGeo ? maxDistKm : null,
            deliveryAvailable: matchStage.deliveryAvailable,
            sellerVerified: isVerifiedFilter,
            listingType,
        };

        const ragInsights = generateRagInsights(
            queryTerm,
            total,
            appliedFilters,
            intent
        );
        const executionTimeMs = Date.now() - startTime;

        res.json({
            listings: pagedListings,
            total,
            page: pageNum,
            pages,
            executionTimeMs,
            ragInsights,
        });
    } catch (err) {
        console.error("searchListings error:", err);
        res.status(500).json({ error: "Failed to perform search." });
    }
};

// ── GET /api/listings/nearby  (protected) ─────────────────────────────────────
// Returns active sell listings within NEARBY_RADIUS_METERS of the buyer's
// saved location, sorted nearest-first.
//
// EFFICIENCY DESIGN:
//   • The listing document already stores a `location` field (snapshotted from
//     the seller at creation time), so the $near query hits the Listing
//     collection's own 2dsphere index — no join, no second collection scan.
//   • The buyer's coordinates come from req.user (populated by authMiddleware)
//     with a single .lean() select, avoiding a second DB round-trip when the
//     middleware already hydrates the user object. If authMiddleware only
//     attaches _id, we do one lean select — still a single extra query at most.
//   • .lean() returns plain JS objects (no Mongoose overhead) for read-only use.
// ─────────────────────────────────────────────────────────────────────────────
export const getNearbyListings = async (req, res) => {
    try {
        const limitNum = Math.min(50, parseInt(req.query.limit, 10) || 10);

        // ── 1. Get buyer coordinates ────────────────────────────────────────────
        // Prefer coordinates already on req.user (set by authMiddleware) to avoid
        // an extra DB round-trip. Fall back to a lean DB fetch if not present.
        let coords = req.user?.location?.coordinates;

        if (!coords?.length) {
            const user = await User.findById(req.user._id)
                .select("location")
                .lean();
            coords = user?.location?.coordinates;
        }

        if (!coords?.length) {
            return res.status(400).json({
                error: "Your account does not have a saved location. Please update your profile.",
            });
        }

        const [lng, lat] = coords; // GeoJSON order: [longitude, latitude]

        // ── 2. Geo query on Listing's own 2dsphere index ────────────────────────
        // The listing's `location` field was snapshotted from the seller at
        // creation time, so "$near on Listing.location" is exactly:
        //   "seller was within X km when they listed this item"
        // which satisfies the "seller within 20 km of buyer" requirement without
        // touching the User collection at all.
        const listings = await Listing.find({
            status: "active",
            listingType: "sell",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: NEARBY_RADIUS_METERS,
                },
            },
        })
            .select("-__v")                              // trim unneeded field
            .populate("seller", "firstName lastName")
            .limit(limitNum)
            .lean();

        res.json({ listings, total: listings.length });
    } catch (err) {
        console.error("getNearbyListings error:", err);
        res.status(500).json({ error: "Failed to fetch nearby listings." });
    }
};

// ── GET /api/listings/my  (protected) ────────────────────────────────────────
export const getMyListings = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, listingType } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 20);

        const filter = { seller: req.user._id };
        if (status) filter.status = status;
        if (listingType) filter.listingType = listingType;

        const [listings, total] = await Promise.all([
            Listing.find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Listing.countDocuments(filter),
        ]);

        res.json({
            listings,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error("getMyListings error:", err);
        res.status(500).json({ error: "Failed to fetch your listings." });
    }
};

// ── GET /api/listings/:id ─────────────────────────────────────────────────────
export const getListingById = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id)
            .populate("seller", "firstName lastName email phoneNumber")
            .lean();
        if (!listing) return res.status(404).json({ error: "Listing not found." });
        res.json({ listing });
    } catch (err) {
        console.error("getListingById error:", err);
        res.status(500).json({ error: "Failed to fetch listing." });
    }
};

// ── PATCH /api/listings/:id/status  (protected) ───────────────────────────────
export const updateListingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ["active", "sold", "rented", "archived"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: "Invalid status value." });
        }

        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ error: "Listing not found." });

        if (listing.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorised." });
        }

        listing.status = status;
        await listing.save();

        res.json({ message: "Status updated.", listing });
    } catch (err) {
        console.error("updateListingStatus error:", err);
        res.status(500).json({ error: "Failed to update status." });
    }
};

// ── DELETE /api/listings/:id ──────────────────────────────────────────────────
export const deleteListing = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ error: "Listing not found." });

        if (listing.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorised." });
        }

        listing.images.forEach(({ filename }) => {
            if (filename) fs.unlink(path.join(uploadsDir, filename), () => { });
        });

        await listing.deleteOne();
        res.json({ message: "Listing deleted." });
    } catch (err) {
        console.error("deleteListing error:", err);
        res.status(500).json({ error: "Failed to delete listing." });
    }
};