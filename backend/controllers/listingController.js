import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Listing from "../models/listing.js";
import User from "../models/user.js";

const num = (v) => (v !== undefined && v !== null && v !== "" && !isNaN(Number(v)) ? Number(v) : undefined);
const bool = (v) => v === true || v === "true" || v === 1 || v === "1";

const NEARBY_RADIUS_METERS = 20000;

// Multer -> Node.js middleware for handling multipart/form-data, which is primarily used for uploading files.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "../uploads/listings");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// destination: The folder where the uploaded files will be stored. In this case, it's set to the uploadsDir, which is a directory named "uploads/listings" relative to the current file's directory.
// filename: The name of the file within the destination folder. Here, it's set to the original name of the uploaded file (file.originalname).

// cb(error, destination)

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
})


const fileFilter = (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Only jpeg, png, webp and gif images are allowed"), false);
    }
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 6 } // 5MB
})

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

        const missing = [];
        if (!listingType) missing.push("listingType");
        if (!title) missing.push("title");
        if (!category) missing.push("category");
        if (!condition) missing.push("condition");
        if (!description) missing.push("description");
        // title, category
        if (missing.length) {
            return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "At least one image is required" });
        }

        const seller = await User.findById(req.user._id).select("location").lean();
        if (!seller?.location?.coordinates?.length) {
            return res.status(400).json({ error: "Seller location is required" });
        }

        const images = req.files.map((f) => ({
            url: `/uploads/listings/${f.filename}`,
            filename: f.filename,
        }));

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
            location: {
                type: "Point",
                coordinates: seller.location.coordinates,
            },
            //sell
            ...(listingType === "sell" && { price: num(price) }),
            //rent
            ...(listingType === "rent" && {
                rentPricePerDay: num(rentPricePerDay),
                depositAmount: num(depositAmount) ?? 0,
                minRentalDays: num(minRentalDays),
                maxRentalDays: num(maxRentalDays),
                rentTerms: rentTerms?.trim(),
            }),
        })

        res.status(201).json({ message: "Listing created successfully", listing });
    } catch (err) {
        if (req.files) {
            req.files.forEach((file) => fs.unlink(file.path, () => { }));
        }
        console.log("Create listing error:", err);
        res.status(500).json({ error: "Failed to create listing." });
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

export const getNearbyListings = async (req, res) => {
    try {
        const limitNum = Math.min(50, parseInt(req.query.limit, 10) || 10); // cap at 50

        // If the user is not authenticated, we cannot get their location
        let coords = req.user?.location?.coordinates;

        if (!coords?.length) {
            const user = await User.findById(req.user._id).select("location").lean();
            coords = user?.location?.coordinates;
        }

        if (!coords?.length) {
            return res.status(400).json({ error: "User location is required to fetch nearby listings." });
        }

        const [lng, lat] = coords;

        const listings = await Listing.find({
            status: "active",
            listingType: "sell",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: NEARBY_RADIUS_METERS,
                }
            }
        }).select("-__v").populate("seller", "firstName lastName").limit(limitNum).lean();

        res.json({ listings, total: listings.length });
    }
    catch (err) {
        console.error("getNearbyListings error:", err);
        res.status(500).json({ error: "Failed to fetch nearby listings." });
    }
}

export const getMyListings = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, listingType } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 20);

        const filter = { seller: req.user._id };
        if (status) { filter.status = status; };
        if (listingType) filter.listingType = listingType;

        const [listings, total] = await Promise.all([
            Listing.find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Listing.countDocuments(filter),
        ]);



        // oldest, newest

        // from most recent to least recent

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

        // /ashugk/asgjos/sduhs/something.png

        await listing.deleteOne();
        res.json({ message: "Listing deleted." });
    } catch (err) {
        console.error("deleteListing error:", err);
        res.status(500).json({ error: "Failed to delete listing." });
    }
};

