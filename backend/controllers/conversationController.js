import mongoose from "mongoose";
import Conversation from "../models/conversation.js";
import Order from "../models/order.js";
import Listing from "../models/listing.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyStatusChange(order, newStatus, actorId, note = "") {
    order.status = newStatus;
    order.statusHistory.push({ status: newStatus, changedBy: actorId, note });
}

/**
 * Append a system message to a conversation and sync derived fields.
 * Does NOT save — caller must save.
 */
function appendSystemMessage(conversation, statusEvent, text) {
    conversation.messages.push({
        senderRole: "system",
        type: "system",
        text,
        statusEvent,
        readBy: [],
    });
    conversation.lastMessage = text;
    conversation.lastMessageAt = new Date();
    conversation.orderStatus = statusEvent;
    // System messages count as unread for both parties
    conversation.unreadBuyer += 1;
    conversation.unreadSeller += 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversations/order/:orderId/init
//
// Called internally by orderController immediately after an order is created.
// Creates the conversation and posts the first system message.
// Can also be called safely more than once (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
export async function initConversation(orderId) {
    const order = await Order.findById(orderId)
        .populate("buyer", "firstName lastName")
        .populate("seller", "firstName lastName");

    if (!order) throw new Error("Order not found for conversation init.");

    const existing = await Conversation.findOne({ order: orderId });
    if (existing) return existing;

    const convo = new Conversation({
        order: order._id,
        buyer: order.buyer._id,
        seller: order.seller._id,
        listingSnapshot: {
            title: order.snapshot.title,
            image: order.snapshot.image,
        },
        orderStatus: "requested",
        messages: [],
        unreadSeller: 1, // seller hasn't seen the new request yet
    });

    const initText = `🛍️ ${order.snapshot.buyerName} has requested "${order.snapshot.title}". Use this chat to discuss details, negotiate, and coordinate.`;
    appendSystemMessage(convo, "requested", initText);
    // The first system message is already counted — undo the double count
    // (appendSystemMessage increments both; buyer sent this request so they know)
    convo.unreadBuyer = 0;

    if (order.buyerNote) {
        convo.messages.push({
            sender: order.buyer._id,
            senderRole: "buyer",
            type: "text",
            text: order.buyerNote,
            readBy: [order.buyer._id],
        });
        convo.lastMessage = order.buyerNote;
        convo.unreadSeller += 1;
    }

    await convo.save();
    return convo;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/conversations
// Returns the inbox for the logged-in user (buyer + seller conversations).
// ─────────────────────────────────────────────────────────────────────────────
export async function getInbox(req, res) {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            $or: [{ buyer: userId }, { seller: userId }],
        })
            .sort({ lastMessageAt: -1 })
            .populate("buyer", "firstName lastName")
            .populate("seller", "firstName lastName")
            .populate("order", "status totalAmount snapshot")
            .select("-messages"); // don't send full message array for inbox

        return res.json({ conversations });
    } catch (err) {
        console.error("getInbox error:", err);
        return res.status(500).json({ error: "Failed to load conversations." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/conversations/order/:orderId
// Returns the full conversation for a specific order.
// Only buyer or seller of that order may access it.
// ─────────────────────────────────────────────────────────────────────────────
export async function getConversation(req, res) {
    try {
        const { orderId } = req.params;
        const userId = req.user._id.toString();

        let convo = await Conversation.findOne({ order: orderId })
            .populate("buyer", "firstName lastName")
            .populate("seller", "firstName lastName")
            .populate("order");

        // If conversation doesn't exist yet, try to initialize it from the order.
        if (!convo) {
            try {
                convo = await initConversation(orderId);
                // Re-populate the newly created conversation for consistency
                convo = await Conversation.findById(convo._id)
                    .populate("buyer", "firstName lastName")
                    .populate("seller", "firstName lastName")
                    .populate("order");
            } catch (initErr) {
                console.error("getConversation init error:", initErr);
                return res.status(404).json({ error: "Conversation not found." });
            }
        }

        const isBuyer = convo.buyer?._id?.toString() === userId;
        const isSeller = convo.seller?._id?.toString() === userId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: "Access denied." });

        // Mark messages as read
        const role = isBuyer ? "buyer" : "seller";
        let updated = false;
        convo.messages.forEach((msg) => {
            if (!msg.readBy.map((id) => id.toString()).includes(userId)) {
                msg.readBy.push(userId);
                updated = true;
            }
        });
        if (updated) {
            if (isBuyer) convo.unreadBuyer = 0;
            else convo.unreadSeller = 0;
            await convo.save();
        }

        return res.json({ conversation: convo, role });
    } catch (err) {
        console.error("getConversation error:", err);
        return res.status(500).json({ error: "Failed to load conversation." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversations/order/:orderId/messages
// Send a text message in the conversation.
// Body: { text }
// ─────────────────────────────────────────────────────────────────────────────
export async function sendMessage(req, res) {
    try {
        const { orderId } = req.params;
        const { text } = req.body;
        const userId = req.user._id.toString();

        if (!text?.trim()) return res.status(400).json({ error: "Message text is required." });
        if (text.trim().length > 2000) return res.status(400).json({ error: "Message too long." });

        const convo = await Conversation.findOne({ order: orderId });
        if (!convo) return res.status(404).json({ error: "Conversation not found." });

        const isBuyer = convo.buyer.toString() === userId;
        const isSeller = convo.seller.toString() === userId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: "Access denied." });

        // Block messaging on terminal statuses
        const terminal = ["rejected", "completed", "cancelled"];
        if (terminal.includes(convo.orderStatus)) {
            return res.status(409).json({
                error: `Cannot send messages on a ${convo.orderStatus} order.`,
            });
        }

        const message = {
            sender: req.user._id,
            senderRole: isBuyer ? "buyer" : "seller",
            type: "text",
            text: text.trim(),
            readBy: [req.user._id],
        };

        convo.messages.push(message);
        convo.lastMessage = text.trim();
        convo.lastMessageAt = new Date();
        if (isBuyer) convo.unreadSeller += 1;
        else convo.unreadBuyer += 1;

        await convo.save();

        const savedMsg = convo.messages[convo.messages.length - 1];

        // Emit via Socket.IO (attached to req.app)
        const io = req.app.get("io");
        if (io) {
            io.to(`order:${orderId}`).emit("new_message", {
                conversationId: convo._id,
                orderId,
                message: savedMsg,
            });
        }

        return res.status(201).json({ message: savedMsg });
    } catch (err) {
        console.error("sendMessage error:", err);
        return res.status(500).json({ error: "Failed to send message." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/conversations/order/:orderId/read
// Mark all messages in this conversation as read for the current user.
// ─────────────────────────────────────────────────────────────────────────────
export async function markRead(req, res) {
    try {
        const { orderId } = req.params;
        const userId = req.user._id.toString();

        const convo = await Conversation.findOne({ order: orderId });
        if (!convo) return res.status(404).json({ error: "Conversation not found." });

        const isBuyer = convo.buyer.toString() === userId;
        const isSeller = convo.seller.toString() === userId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: "Access denied." });

        convo.messages.forEach((msg) => {
            if (!msg.readBy.map((id) => id.toString()).includes(userId)) {
                msg.readBy.push(userId);
            }
        });
        if (isBuyer) convo.unreadBuyer = 0;
        else convo.unreadSeller = 0;
        await convo.save();

        return res.json({ ok: true });
    } catch (err) {
        console.error("markRead error:", err);
        return res.status(500).json({ error: "Failed to mark as read." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER ACTION ENDPOINTS — these live here so they emit socket events
// and post system messages atomically.
// Each wraps the equivalent logic from orderController but also updates chat.
// ─────────────────────────────────────────────────────────────────────────────

async function performOrderAction({ orderId, userId, action, body = {}, io }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findById(orderId).session(session);
        if (!order) { await session.abortTransaction(); return { status: 404, error: "Order not found." }; }

        const isBuyer = order.buyer.toString() === userId;
        const isSeller = order.seller.toString() === userId;

        // ── Permission + state guards per action ──────────────────────────────
        if (action === "accept") {
            if (!isSeller) { await session.abortTransaction(); return { status: 403, error: "Only the seller can accept." }; }
            if (order.status !== "requested") { await session.abortTransaction(); return { status: 409, error: `Cannot accept from status: ${order.status}.` }; }
            applyStatusChange(order, "accepted", userId, body.note || "");
            await Listing.findByIdAndUpdate(order.listing, { status: "reserved" }, { session });
            // Auto-reject competing requests
            const others = await Order.find({ listing: order.listing, _id: { $ne: order._id }, status: "requested" }).session(session);
            for (const o of others) {
                applyStatusChange(o, "rejected", userId, "Seller accepted another buyer's request.");
                await o.save({ session });
                // Update their conversations too
                const otherConvo = await Conversation.findOne({ order: o._id }).session(session);
                if (otherConvo) {
                    appendSystemMessage(otherConvo, "rejected", "❌ The seller accepted another buyer's request. This order has been declined.");
                    await otherConvo.save({ session });
                    if (io) io.to(`order:${o._id}`).emit("order_update", { orderId: o._id, status: "rejected" });
                }
            }
        } else if (action === "reject") {
            if (!isSeller) { await session.abortTransaction(); return { status: 403, error: "Only the seller can reject." }; }
            if (order.status !== "requested") { await session.abortTransaction(); return { status: 409, error: `Cannot reject from status: ${order.status}.` }; }
            applyStatusChange(order, "rejected", userId, body.note || "");
        } else if (action === "cancel") {
            if (!isBuyer && !isSeller) { await session.abortTransaction(); return { status: 403, error: "Access denied." }; }
            if (!["requested", "accepted"].includes(order.status)) { await session.abortTransaction(); return { status: 409, error: `Cannot cancel from status: ${order.status}.` }; }
            const wasAccepted = order.status === "accepted";
            applyStatusChange(order, "cancelled", userId, body.reason || "");
            order.cancelledBy = isBuyer ? "buyer" : "seller";
            order.cancellationReason = body.reason || "";
            if (wasAccepted) await Listing.findByIdAndUpdate(order.listing, { status: "active" }, { session });
        } else if (action === "deliver") {
            if (!isSeller) { await session.abortTransaction(); return { status: 403, error: "Only the seller can mark as delivered." }; }
            if (order.status !== "accepted") { await session.abortTransaction(); return { status: 409, error: `Cannot deliver from status: ${order.status}.` }; }
            applyStatusChange(order, "delivered", userId, body.note || "");
        } else if (action === "complete") {
            if (!isBuyer) { await session.abortTransaction(); return { status: 403, error: "Only the buyer can complete." }; }
            if (order.status !== "delivered") { await session.abortTransaction(); return { status: 409, error: `Cannot complete from status: ${order.status}.` }; }
            applyStatusChange(order, "completed", userId, "Buyer confirmed receipt.");
            const finalStatus = order.snapshot.listingType === "rent" ? "rented" : "sold";
            await Listing.findByIdAndUpdate(order.listing, { status: finalStatus }, { session });
        } else if (action === "dispute") {
            if (!isBuyer && !isSeller) { await session.abortTransaction(); return { status: 403, error: "Access denied." }; }
            if (order.status !== "delivered") { await session.abortTransaction(); return { status: 409, error: "Disputes only on delivered orders." }; }
            if (!body.reason) { await session.abortTransaction(); return { status: 400, error: "A reason is required." }; }
            applyStatusChange(order, "disputed", userId, body.reason);
            order.disputeReason = body.reason;
            order.disputeOpenedBy = isBuyer ? "buyer" : "seller";
        } else {
            await session.abortTransaction();
            return { status: 400, error: "Unknown action." };
        }

        await order.save({ session });

        // ── Update conversation ────────────────────────────────────────────────
        const convo = await Conversation.findOne({ order: orderId }).session(session);
        if (convo) {
            const systemTexts = {
                accepted: "✅ Order accepted! Use this chat to coordinate payment and delivery details.",
                rejected: `❌ Order declined.${body.note ? ` Seller's note: ${body.note}` : ""}`,
                cancelled: `🚫 Order cancelled${isBuyer ? " by buyer" : " by seller"}.${body.reason ? ` Reason: ${body.reason}` : ""}`,
                delivered: "📦 Seller has marked this order as delivered. Please confirm receipt when you receive it.",
                completed: "🎉 Order completed! Thank you for using our marketplace.",
                disputed: `⚠️ A dispute has been opened. Reason: ${body.reason}`,
            };
            appendSystemMessage(convo, order.status, systemTexts[order.status] || `Status changed to ${order.status}.`);
            convo.orderStatus = order.status;
            await convo.save({ session });
        }

        await session.commitTransaction();

        // ── Emit socket event ─────────────────────────────────────────────────
        if (io && convo) {
            const systemMsg = convo.messages[convo.messages.length - 1];
            io.to(`order:${orderId}`).emit("new_message", {
                conversationId: convo._id,
                orderId,
                message: systemMsg,
            });
            io.to(`order:${orderId}`).emit("order_update", {
                orderId,
                status: order.status,
                order,
            });
        }

        return { status: 200, order };
    } catch (err) {
        await session.abortTransaction();
        console.error(`performOrderAction(${action}) error:`, err);
        return { status: 500, error: "Action failed." };
    } finally {
        session.endSession();
    }
}

// Express route handlers that delegate to performOrderAction
export async function acceptOrderChat(req, res) {
    const result = await performOrderAction({ orderId: req.params.orderId, userId: req.user._id.toString(), action: "accept", body: req.body, io: req.app.get("io") });
    return res.status(result.status).json(result.error ? { error: result.error } : { order: result.order });
}
export async function rejectOrderChat(req, res) {
    const result = await performOrderAction({ orderId: req.params.orderId, userId: req.user._id.toString(), action: "reject", body: req.body, io: req.app.get("io") });
    return res.status(result.status).json(result.error ? { error: result.error } : { order: result.order });
}
export async function cancelOrderChat(req, res) {
    const result = await performOrderAction({ orderId: req.params.orderId, userId: req.user._id.toString(), action: "cancel", body: req.body, io: req.app.get("io") });
    return res.status(result.status).json(result.error ? { error: result.error } : { order: result.order });
}
export async function deliverOrderChat(req, res) {
    const result = await performOrderAction({ orderId: req.params.orderId, userId: req.user._id.toString(), action: "deliver", body: req.body, io: req.app.get("io") });
    return res.status(result.status).json(result.error ? { error: result.error } : { order: result.order });
}
export async function completeOrderChat(req, res) {
    const result = await performOrderAction({ orderId: req.params.orderId, userId: req.user._id.toString(), action: "complete", body: req.body, io: req.app.get("io") });
    return res.status(result.status).json(result.error ? { error: result.error } : { order: result.order });
}
export async function disputeOrderChat(req, res) {
    const result = await performOrderAction({ orderId: req.params.orderId, userId: req.user._id.toString(), action: "dispute", body: req.body, io: req.app.get("io") });
    return res.status(result.status).json(result.error ? { error: result.error } : { order: result.order });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/review  (submit review — unchanged, no socket needed)
// ─────────────────────────────────────────────────────────────────────────────
export async function submitReviewChat(req, res) {
    try {
        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1–5." });

        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: "Order not found." });
        if (order.buyer.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Only the buyer can review." });
        if (order.status !== "completed") return res.status(409).json({ error: "Can only review completed orders." });
        if (order.review?.submittedAt) return res.status(409).json({ error: "Already reviewed." });

        order.review = { rating, comment, submittedAt: new Date() };
        await order.save();

        // Post a system message in the chat
        const convo = await Conversation.findOne({ order: order._id });
        if (convo) {
            const stars = "⭐".repeat(rating);
            convo.messages.push({
                senderRole: "system",
                type: "system",
                text: `${stars} Buyer left a review.${comment ? ` "${comment}"` : ""}`,
                readBy: [],
            });
            convo.lastMessage = `Buyer left a ${rating}-star review.`;
            convo.lastMessageAt = new Date();
            await convo.save();
        }

        return res.json({ review: order.review });
    } catch (err) {
        console.error("submitReviewChat error:", err);
        return res.status(500).json({ error: "Failed to submit review." });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/conversations/unread
// Returns total unread count for the nav badge.
// ─────────────────────────────────────────────────────────────────────────────
export async function getUnreadCount(req, res) {
    try {
        const userId = req.user._id;
        const conversations = await Conversation.find({ $or: [{ buyer: userId }, { seller: userId }] }).select("buyer seller unreadBuyer unreadSeller");
        let total = 0;
        conversations.forEach((c) => {
            if (c.buyer.toString() === userId.toString()) total += c.unreadBuyer;
            else total += c.unreadSeller;
        });
        return res.json({ unread: total });
    } catch (err) {
        return res.status(500).json({ error: "Failed to get unread count." });
    }
}