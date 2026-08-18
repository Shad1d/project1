import Cart from "../models/cart.js";
import Listing from "../models/listing.js";

const getApiBaseUrl = () => process.env.API_BASE_URL || process.env.VITE_API_URL || "";

/**
 * Resolve a listing's first image to a full URL.
 * Mirrors the same logic in ProductCard.jsx on the frontend.
 */
function resolveImage(listing) {
    if (!listing.images?.length) return "";
    const url = listing.images[0].url;
    if (url.startsWith("http")) return url;
    const baseUrl = getApiBaseUrl();
    return !baseUrl ? url : `${baseUrl}${url}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cart
// Returns the current user's cart (populated with latest listing data).
// ─────────────────────────────────────────────────────────────────────────────
export async function getCart(req, res) {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.json({ items: [], estimatedTotal: 0 });
        return res.json({ items: cart.items, estimatedTotal: cart.estimatedTotal });
    } catch (err) {
        console.error("getCart error:", err);
        return res.status(500).json({ error: "Failed to fetch cart." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cart/items
// Body: { listingId, quantity, rentalDays? }
// Adds an item to the cart or increments its quantity if already present.
// ─────────────────────────────────────────────────────────────────────────────
export async function addToCart(req, res) {
    try {
        const { listingId, quantity = 1, rentalDays } = req.body;

        if (!listingId) return res.status(400).json({ error: "listingId is required." });
        if (quantity < 1) return res.status(400).json({ error: "Quantity must be at least 1." });

        // ── Fetch and validate listing ─────────────────────────────────────────
        const listing = await Listing.findById(listingId).populate("seller", "firstName lastName");
        if (!listing) return res.status(404).json({ error: "Listing not found." });

        if (listing.status !== "active") {
            return res.status(409).json({
                error: `This listing is no longer available (status: ${listing.status}).`,
            });
        }

        // Prevent seller from adding their own listing to cart.
        // listing.seller may be a populated object or a bare ObjectId (if the
        // seller document was deleted), so we normalise both cases.
        const sellerIdStr = (listing.seller?._id ?? listing.seller)?.toString();
        if (sellerIdStr === req.user._id.toString()) {
            return res.status(403).json({ error: "You cannot add your own listing to the cart." });
        }

        // Rental validation
        if (listing.listingType === "rent") {
            if (!rentalDays || rentalDays < 1)
                return res.status(400).json({ error: "rentalDays is required for rental listings." });
            if (listing.minRentalDays && rentalDays < listing.minRentalDays)
                return res.status(400).json({
                    error: `Minimum rental period is ${listing.minRentalDays} day(s).`,
                });
            if (listing.maxRentalDays && rentalDays > listing.maxRentalDays)
                return res.status(400).json({
                    error: `Maximum rental period is ${listing.maxRentalDays} day(s).`,
                });
        }

        // ── Upsert cart ────────────────────────────────────────────────────────
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }

        const existingIdx = cart.items.findIndex(
            (i) => i.listing.toString() === listingId
        );

        const itemSnapshot = {
            listing: listing._id,
            title: listing.title,
            listingType: listing.listingType,
            price: listing.price,
            rentPricePerDay: listing.rentPricePerDay,
            image: resolveImage(listing),
            condition: listing.condition,
            sellerName: listing.seller?.firstName
                ? `${listing.seller.firstName} ${listing.seller.lastName}`
                : "Unknown Seller",
            quantity,
            ...(listing.listingType === "rent" && { rentalDays }),
        };

        if (existingIdx >= 0) {
            cart.items[existingIdx].quantity += quantity;
            if (rentalDays) cart.items[existingIdx].rentalDays = rentalDays;
        } else {
            cart.items.push(itemSnapshot);
        }

        await cart.save();

        return res.status(200).json({
            message: "Item added to cart.",
            items: cart.items,
            estimatedTotal: cart.estimatedTotal,
        });
    } catch (err) {
        console.error("addToCart error:", err);
        return res.status(500).json({ error: "Failed to add item to cart." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cart/items/:itemId
// Body: { quantity?, rentalDays? }
// Updates quantity or rentalDays for a specific cart item.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCartItem(req, res) {
    try {
        const { itemId } = req.params;
        const { quantity, rentalDays } = req.body;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.status(404).json({ error: "Cart not found." });

        const item = cart.items.id(itemId);
        if (!item) return res.status(404).json({ error: "Cart item not found." });

        if (quantity !== undefined) {
            if (quantity < 1) return res.status(400).json({ error: "Quantity must be at least 1." });
            item.quantity = quantity;
        }

        if (rentalDays !== undefined) {
            if (rentalDays < 1)
                return res.status(400).json({ error: "Rental days must be at least 1." });

            // Validate against listing's min/max rental constraints
            const listing = await Listing.findById(item.listing);
            if (listing) {
                if (listing.minRentalDays && rentalDays < listing.minRentalDays)
                    return res.status(400).json({
                        error: `Minimum rental period is ${listing.minRentalDays} day(s).`,
                    });
                if (listing.maxRentalDays && rentalDays > listing.maxRentalDays)
                    return res.status(400).json({
                        error: `Maximum rental period is ${listing.maxRentalDays} day(s).`,
                    });
            }

            item.rentalDays = rentalDays;
        }

        await cart.save();

        return res.json({
            message: "Cart item updated.",
            items: cart.items,
            estimatedTotal: cart.estimatedTotal,
        });
    } catch (err) {
        console.error("updateCartItem error:", err);
        return res.status(500).json({ error: "Failed to update cart item." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cart/items/:itemId
// Removes a single item from the cart.
// ─────────────────────────────────────────────────────────────────────────────
export async function removeCartItem(req, res) {
    try {
        const { itemId } = req.params;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.status(404).json({ error: "Cart not found." });

        const before = cart.items.length;
        cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
        if (cart.items.length === before)
            return res.status(404).json({ error: "Cart item not found." });

        await cart.save();

        return res.json({
            message: "Item removed from cart.",
            items: cart.items,
            estimatedTotal: cart.estimatedTotal,
        });
    } catch (err) {
        console.error("removeCartItem error:", err);
        return res.status(500).json({ error: "Failed to remove cart item." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cart
// Clears the entire cart.
// ─────────────────────────────────────────────────────────────────────────────
export async function clearCart(req, res) {
    try {
        await Cart.findOneAndUpdate(
            { user: req.user._id },
            { $set: { items: [] } }
        );
        return res.json({ message: "Cart cleared.", items: [], estimatedTotal: 0 });
    } catch (err) {
        console.error("clearCart error:", err);
        return res.status(500).json({ error: "Failed to clear cart." });
    }
}