import mongoose from "mongoose";
import Order from "../models/order.js";
import Listing from "../models/listing.js";
import Cart from "../models/cart.js";
import User from "../models/user.js";
import { initConversation } from "./conversationController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveImage(listing) {
    if (!listing.images?.length) return "";
    const url = listing.images[0].url;
    // If it's already absolute keep it; otherwise prepend API base
    return url.startsWith("http")
        ? url
        : `${process.env.API_BASE_URL || ""}${url}`;
}

/**
 * Append a status-history event and update the top-level status in one shot.
 */
function applyStatusChange(order, newStatus, actorId, note = "") {
    order.status = newStatus;
    order.statusHistory.push({ status: newStatus, changedBy: actorId, note });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders
// Body: { listingId, quantity, rentalDays?, rentalStartDate?,
//         buyerNote?, paymentMethod?, deliveryMethod?, deliveryAddress?, meetupLocation? }
//
// Creates a new order from a direct "Request Item" action.
// The listing must be active and not belong to the buyer.
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            listingId,
            quantity = 1,
            rentalDays,
            rentalStartDate,
            buyerNote,
            paymentMethod,
            deliveryMethod,
            deliveryAddress,
            meetupLocation,
        } = req.body;

        if (!listingId) {
            await session.abortTransaction();
            return res.status(400).json({ error: "listingId is required." });
        }

        // ── Fetch listing with seller populated ───────────────────────────────
        const listing = await Listing.findById(listingId)
            .populate("seller", "firstName lastName email phoneNumber")
            .session(session);

        if (!listing) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Listing not found." });
        }

        if (listing.status !== "active") {
            await session.abortTransaction();
            return res.status(409).json({
                error: `This listing is no longer available (status: ${listing.status}).`,
            });
        }

        if (listing.seller._id.toString() === req.user._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ error: "You cannot order your own listing." });
        }

        // ── Check for an existing open order (idempotency guard) ──────────────
        const existingOrder = await Order.findOne({
            buyer: req.user._id,
            listing: listing._id,
            status: { $in: ["requested", "accepted"] },
        }).session(session);

        if (existingOrder) {
            await session.abortTransaction();
            return res.status(409).json({
                error: "You already have an active request for this listing.",
                orderId: existingOrder._id,
            });
        }

        // ── Validate requested quantity against available stock ───────────────
        // Available = listing.quantity minus units already locked in accepted orders.
        // We count accepted orders only — requested orders don't lock stock yet,
        // multiple buyers can request; seller picks who to accept.
        const acceptedAgg = await Order.aggregate([
            { $match: { listing: listing._id, status: "accepted" } },
            { $group: { _id: null, total: { $sum: "$quantity" } } },
        ]);
        const lockedQty = acceptedAgg[0]?.total || 0;
        const availableQty = listing.quantity - lockedQty;

        if (quantity > availableQty) {
            await session.abortTransaction();
            return res.status(409).json({
                error: `Only ${availableQty} unit(s) available for this listing.`,
                available: availableQty,
            });
        }

        // ── Build price snapshot ──────────────────────────────────────────────
        let agreedPrice, totalAmount;
        if (listing.listingType === "rent") {
            if (!rentalDays || rentalDays < 1) {
                await session.abortTransaction();
                return res.status(400).json({ error: "rentalDays is required for rental listings." });
            }
            agreedPrice = listing.rentPricePerDay;
            totalAmount = listing.rentPricePerDay * rentalDays * quantity;
        } else {
            agreedPrice = listing.price;
            totalAmount = listing.price * quantity;
        }

        // ── Calculate rental end date if start date provided ──────────────────
        let rentalEndDate;
        if (rentalStartDate && rentalDays) {
            const start = new Date(rentalStartDate);
            rentalEndDate = new Date(start);
            rentalEndDate.setDate(rentalEndDate.getDate() + Number(rentalDays));
        }

        const buyer = await User.findById(req.user._id).session(session);

        // ── Create order ──────────────────────────────────────────────────────
        const order = new Order({
            buyer: req.user._id,
            seller: listing.seller._id,
            listing: listing._id,
            snapshot: {
                title: listing.title,
                listingType: listing.listingType,
                price: listing.price,
                rentPricePerDay: listing.rentPricePerDay,
                image: resolveImage(listing),
                category: listing.category,
                condition: listing.condition,
                sellerName: `${listing.seller.firstName} ${listing.seller.lastName}`,
                buyerName: `${buyer.firstName} ${buyer.lastName}`,
            },
            quantity,
            ...(listing.listingType === "rent" && {
                rentalDays,
                rentalStartDate: rentalStartDate ? new Date(rentalStartDate) : undefined,
                rentalEndDate,
            }),
            agreedPrice,
            totalAmount,
            paymentMethod,
            deliveryMethod,
            deliveryAddress,
            meetupLocation,
            buyerNote,
            status: "requested",
            statusHistory: [
                { status: "requested", changedBy: req.user._id, note: "Order created by buyer." },
            ],
        });

        await order.save({ session });

        // Inventory is NOT modified at request time.
        // Stock is only deducted when the seller accepts (in acceptOrder).
        // This lets multiple buyers request simultaneously; the seller decides.

        await session.commitTransaction();

        // ── Auto-create conversation thread ──────────────────────────────────
        try {
            await initConversation(order._id);
        } catch (convErr) {
            // Non-fatal: order is saved; log and continue
            console.error("initConversation error:", convErr);
        }

        // Populate for response
        await order.populate("buyer", "firstName lastName email phoneNumber");
        await order.populate("seller", "firstName lastName email phoneNumber");
        await order.populate("listing", "title status");

        // TODO: send notification to seller (email / in-app)

        return res.status(201).json({
            message: "Order request sent to seller.",
            order,
        });
    } catch (err) {
        await session.abortTransaction();
        console.error("createOrder error:", err);
        return res.status(500).json({ error: "Failed to create order." });
    } finally {
        session.endSession();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/from-cart
// Body: { listingId, buyerNote?, paymentMethod?, deliveryMethod?,
//         deliveryAddress?, meetupLocation? }
//
// Places an order for a single item currently in the buyer's cart,
// then removes that item from the cart.
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrderFromCart(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { listingId, buyerNote, paymentMethod, deliveryMethod, deliveryAddress, meetupLocation } = req.body;

        if (!listingId) {
            await session.abortTransaction();
            return res.status(400).json({ error: "listingId is required." });
        }

        // ── Find item in cart ─────────────────────────────────────────────────
        const cart = await Cart.findOne({ user: req.user._id }).session(session);
        if (!cart) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Cart not found." });
        }

        const cartItem = cart.items.find((i) => i.listing.toString() === listingId);
        if (!cartItem) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Item not found in cart." });
        }

        // ── Re-validate listing (status can change between add-to-cart and checkout) ─
        const listing = await Listing.findById(listingId)
            .populate("seller", "firstName lastName email phoneNumber")
            .session(session);

        if (!listing || listing.status !== "active") {
            await session.abortTransaction();
            return res.status(409).json({
                error: "This listing is no longer available.",
            });
        }

        if (listing.seller._id.toString() === req.user._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ error: "You cannot order your own listing." });
        }

        // Idempotency guard
        const existingOrder = await Order.findOne({
            buyer: req.user._id,
            listing: listing._id,
            status: { $in: ["requested", "accepted"] },
        }).session(session);

        if (existingOrder) {
            await session.abortTransaction();
            return res.status(409).json({
                error: "You already have an active request for this listing.",
                orderId: existingOrder._id,
            });
        }

        // ── Validate quantity against available stock ─────────────────────────
        const cartQty = cartItem.quantity;
        const acceptedAgg2 = await Order.aggregate([
            { $match: { listing: listing._id, status: "accepted" } },
            { $group: { _id: null, total: { $sum: "$quantity" } } },
        ]);
        const lockedQty2 = acceptedAgg2[0]?.total || 0;
        const availableQty2 = listing.quantity - lockedQty2;

        if (cartQty > availableQty2) {
            await session.abortTransaction();
            return res.status(409).json({
                error: `Only ${availableQty2} unit(s) available. Update your cart quantity and try again.`,
                available: availableQty2,
            });
        }

        const buyer = await User.findById(req.user._id).session(session);

        // ── Compute totals from cart item ─────────────────────────────────────
        let agreedPrice, totalAmount;
        if (listing.listingType === "rent") {
            agreedPrice = listing.rentPricePerDay;
            totalAmount = listing.rentPricePerDay * (cartItem.rentalDays ?? 1) * cartItem.quantity;
        } else {
            agreedPrice = listing.price;
            totalAmount = listing.price * cartItem.quantity;
        }

        const order = new Order({
            buyer: req.user._id,
            seller: listing.seller._id,
            listing: listing._id,
            snapshot: {
                title: listing.title,
                listingType: listing.listingType,
                price: listing.price,
                rentPricePerDay: listing.rentPricePerDay,
                image: resolveImage(listing),
                category: listing.category,
                condition: listing.condition,
                sellerName: `${listing.seller.firstName} ${listing.seller.lastName}`,
                buyerName: `${buyer.firstName} ${buyer.lastName}`,
            },
            quantity: cartItem.quantity,
            ...(listing.listingType === "rent" && { rentalDays: cartItem.rentalDays }),
            agreedPrice,
            totalAmount,
            paymentMethod,
            deliveryMethod,
            deliveryAddress,
            meetupLocation,
            buyerNote,
            status: "requested",
            statusHistory: [
                { status: "requested", changedBy: req.user._id, note: "Order placed from cart." },
            ],
        });

        await order.save({ session });

        // Remove the ordered item from the cart
        cart.items = cart.items.filter((i) => i.listing.toString() !== listingId);
        await cart.save({ session });

        await session.commitTransaction();
        try {
            await initConversation(order._id);
        } catch (convErr) {
            console.error("initConversation error:", convErr);
        }

        await order.populate("buyer", "firstName lastName email phoneNumber");
        await order.populate("seller", "firstName lastName email phoneNumber");

        return res.status(201).json({
            message: "Order request sent to seller.",
            order,
        });
    } catch (err) {
        await session.abortTransaction();
        console.error("createOrderFromCart error:", err);
        return res.status(500).json({ error: "Failed to place order." });
    } finally {
        session.endSession();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/buyer
// Returns all orders placed by the logged-in user (buyer dashboard).
// Query: ?status=requested,accepted&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
export async function getBuyerOrders(req, res) {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = { buyer: req.user._id };
        if (status) {
            const statuses = status.split(",").map((s) => s.trim());
            filter.status = { $in: statuses };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("seller", "firstName lastName email phoneNumber")
                .populate("listing", "title status images")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit)),
            Order.countDocuments(filter),
        ]);

        return res.json({ orders, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error("getBuyerOrders error:", err);
        return res.status(500).json({ error: "Failed to fetch orders." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/seller
// Returns all orders received by the logged-in user (seller dashboard).
// Query: ?status=requested&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
export async function getSellerOrders(req, res) {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = { seller: req.user._id };
        if (status) {
            const statuses = status.split(",").map((s) => s.trim());
            filter.status = { $in: statuses };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("buyer", "firstName lastName email phoneNumber address")
                .populate("listing", "title status images")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit)),
            Order.countDocuments(filter),
        ]);

        return res.json({ orders, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error("getSellerOrders error:", err);
        return res.status(500).json({ error: "Failed to fetch seller orders." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/:orderId
// Returns a single order. Only buyer or seller can view it.
// ─────────────────────────────────────────────────────────────────────────────
export async function getOrder(req, res) {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate("buyer", "firstName lastName email phoneNumber address")
            .populate("seller", "firstName lastName email phoneNumber address")
            .populate("listing", "title status images listingType price rentPricePerDay");

        if (!order) return res.status(404).json({ error: "Order not found." });

        const userId = req.user._id.toString();
        const isBuyer = order.buyer._id.toString() === userId;
        const isSeller = order.seller._id.toString() === userId;

        if (!isBuyer && !isSeller) {
            return res.status(403).json({ error: "Access denied." });
        }

        return res.json({ order });
    } catch (err) {
        console.error("getOrder error:", err);
        return res.status(500).json({ error: "Failed to fetch order." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/accept
// Seller accepts the order → reserves the listing.
// ─────────────────────────────────────────────────────────────────────────────
export async function acceptOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findById(req.params.orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Order not found." });
        }

        if (order.seller.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ error: "Only the seller can accept this order." });
        }

        if (order.status !== "requested") {
            await session.abortTransaction();
            return res.status(409).json({
                error: `Cannot accept an order with status: ${order.status}.`,
            });
        }

        // ── Accept the order ──────────────────────────────────────────────────
        applyStatusChange(order, "accepted", req.user._id, req.body.note || "");
        if (req.body.sellerNote) order.sellerNote = req.body.sellerNote;
        await order.save({ session });

        // ── Deduct stock and conditionally reserve the listing ─────────────────
        // Decrement listing.quantity by the ordered quantity.
        // If stock reaches 0 → mark listing "reserved" (no more requests allowed).
        // If stock remains > 0 → listing stays "active" (other buyers can still request).
        const updatedListing = await Listing.findByIdAndUpdate(
            order.listing,
            { $inc: { quantity: -order.quantity } },
            { new: true, session }
        );

        if (updatedListing.quantity <= 0) {
            updatedListing.quantity = 0; // clamp — never go negative
            updatedListing.status = "reserved";
            await updatedListing.save({ session });

            // Stock exhausted → auto-reject all other pending requests
            const otherOrders = await Order.find({
                listing: order.listing,
                _id: { $ne: order._id },
                status: "requested",
            }).session(session);

            for (const other of otherOrders) {
                applyStatusChange(
                    other,
                    "rejected",
                    req.user._id,
                    "No stock remaining — seller accepted another request."
                );
                await other.save({ session });
            }
        }
        // If stock > 0 the listing remains "active"; other buyers' pending requests
        // are still valid and the seller can accept more of them.

        await session.commitTransaction();

        await order.populate("buyer", "firstName lastName email phoneNumber");
        await order.populate("seller", "firstName lastName email phoneNumber");

        // TODO: notify buyer that their order was accepted
        // TODO: notify other buyers that their request was rejected

        return res.json({ message: "Order accepted. Listing is now reserved.", order });
    } catch (err) {
        await session.abortTransaction();
        console.error("acceptOrder error:", err);
        return res.status(500).json({ error: "Failed to accept order." });
    } finally {
        session.endSession();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/reject
// Seller rejects the order. Listing stays active.
// ─────────────────────────────────────────────────────────────────────────────
export async function rejectOrder(req, res) {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: "Order not found." });

        if (order.seller.toString() !== req.user._id.toString())
            return res.status(403).json({ error: "Only the seller can reject this order." });

        if (order.status !== "requested")
            return res.status(409).json({ error: `Cannot reject an order with status: ${order.status}.` });

        applyStatusChange(order, "rejected", req.user._id, req.body.note || "");
        if (req.body.sellerNote) order.sellerNote = req.body.sellerNote;
        await order.save();

        // Listing remains active — no inventory change needed.

        // TODO: notify buyer

        return res.json({ message: "Order rejected.", order });
    } catch (err) {
        console.error("rejectOrder error:", err);
        return res.status(500).json({ error: "Failed to reject order." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/cancel
// Either buyer or seller can cancel before delivery.
// Body: { reason? }
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findById(req.params.orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Order not found." });
        }

        const userId = req.user._id.toString();
        const isBuyer = order.buyer.toString() === userId;
        const isSeller = order.seller.toString() === userId;

        if (!isBuyer && !isSeller) {
            await session.abortTransaction();
            return res.status(403).json({ error: "Access denied." });
        }

        const cancellableStatuses = ["requested", "accepted"];
        if (!cancellableStatuses.includes(order.status)) {
            await session.abortTransaction();
            return res.status(409).json({
                error: `Cannot cancel an order with status: ${order.status}.`,
            });
        }

        const wasAccepted = order.status === "accepted";

        applyStatusChange(order, "cancelled", req.user._id, req.body.reason || "");
        order.cancelledBy = isBuyer ? "buyer" : "seller";
        order.cancellationReason = req.body.reason || "";
        await order.save({ session });

        // ── Restore stock if the order had already been accepted ──────────────
        // When accepted, stock was decremented. On cancellation we give it back.
        // After restoring, if the listing was "reserved" (stock was 0) and now
        // has stock again, revert it to "active" so new buyers can request it.
        if (wasAccepted) {
            const restoredListing = await Listing.findByIdAndUpdate(
                order.listing,
                { $inc: { quantity: order.quantity } },
                { new: true, session }
            );

            // Only re-activate if listing was reserved (not sold/rented/archived)
            if (restoredListing.status === "reserved" && restoredListing.quantity > 0) {
                restoredListing.status = "active";
                await restoredListing.save({ session });
            }
        }
        // If order was only "requested" (never accepted), stock was never touched
        // so nothing to restore.

        await session.commitTransaction();

        // TODO: notify the other party

        return res.json({ message: "Order cancelled.", order });
    } catch (err) {
        await session.abortTransaction();
        console.error("cancelOrder error:", err);
        return res.status(500).json({ error: "Failed to cancel order." });
    } finally {
        session.endSession();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/deliver
// Seller marks order as delivered.
// ─────────────────────────────────────────────────────────────────────────────
export async function markDelivered(req, res) {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: "Order not found." });

        if (order.seller.toString() !== req.user._id.toString())
            return res.status(403).json({ error: "Only the seller can mark as delivered." });

        if (order.status !== "accepted")
            return res.status(409).json({ error: `Cannot mark as delivered from status: ${order.status}.` });

        applyStatusChange(order, "delivered", req.user._id, req.body.note || "");
        await order.save();

        // TODO: notify buyer to confirm receipt

        return res.json({ message: "Order marked as delivered.", order });
    } catch (err) {
        console.error("markDelivered error:", err);
        return res.status(500).json({ error: "Failed to mark order as delivered." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/complete
// Buyer confirms receipt → marks order complete, marks listing sold/rented.
// ─────────────────────────────────────────────────────────────────────────────
export async function completeOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findById(req.params.orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Order not found." });
        }

        if (order.buyer.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ error: "Only the buyer can complete the order." });
        }

        if (order.status !== "delivered") {
            await session.abortTransaction();
            return res.status(409).json({ error: `Cannot complete an order with status: ${order.status}.` });
        }

        applyStatusChange(order, "completed", req.user._id, "Buyer confirmed receipt.");
        await order.save({ session });

        // ── Mark listing sold/rented only when all stock is gone ──────────────
        // Stock was already decremented at accept time.
        // If quantity is now 0 (reserved), permanently close the listing.
        // If quantity > 0, leave it active — seller still has units to sell.
        const listingAfterComplete = await Listing.findById(order.listing).session(session);
        if (listingAfterComplete && listingAfterComplete.quantity <= 0) {
            const finalStatus = order.snapshot.listingType === "rent" ? "rented" : "sold";
            listingAfterComplete.status = finalStatus;
            await listingAfterComplete.save({ session });
        }

        await session.commitTransaction();

        return res.json({ message: "Order completed. Thank you!", order });
    } catch (err) {
        await session.abortTransaction();
        console.error("completeOrder error:", err);
        return res.status(500).json({ error: "Failed to complete order." });
    } finally {
        session.endSession();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/dispute
// Buyer or seller opens a dispute after delivery.
// Body: { reason }
// ─────────────────────────────────────────────────────────────────────────────
export async function disputeOrder(req, res) {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: "Order not found." });

        const userId = req.user._id.toString();
        const isBuyer = order.buyer.toString() === userId;
        const isSeller = order.seller.toString() === userId;

        if (!isBuyer && !isSeller) return res.status(403).json({ error: "Access denied." });

        if (order.status !== "delivered")
            return res.status(409).json({ error: "Disputes can only be opened on delivered orders." });

        if (!req.body.reason)
            return res.status(400).json({ error: "A reason is required to open a dispute." });

        applyStatusChange(order, "disputed", req.user._id, req.body.reason);
        order.disputeReason = req.body.reason;
        order.disputeOpenedBy = isBuyer ? "buyer" : "seller";
        await order.save();

        // TODO: notify admin + other party

        return res.json({ message: "Dispute opened. Our team will review it shortly.", order });
    } catch (err) {
        console.error("disputeOrder error:", err);
        return res.status(500).json({ error: "Failed to open dispute." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/review
// Buyer submits a review after order is completed.
// Body: { rating (1-5), comment }
// ─────────────────────────────────────────────────────────────────────────────
export async function submitReview(req, res) {
    try {
        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5)
            return res.status(400).json({ error: "Rating must be between 1 and 5." });

        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: "Order not found." });

        if (order.buyer.toString() !== req.user._id.toString())
            return res.status(403).json({ error: "Only the buyer can submit a review." });

        if (order.status !== "completed")
            return res.status(409).json({ error: "Reviews can only be submitted for completed orders." });

        if (order.review?.submittedAt)
            return res.status(409).json({ error: "You have already reviewed this order." });

        order.review = { rating, comment, submittedAt: new Date() };
        await order.save();

        return res.json({ message: "Review submitted.", review: order.review });
    } catch (err) {
        console.error("submitReview error:", err);
        return res.status(500).json({ error: "Failed to submit review." });
    }
}