import mongoose from "mongoose";

/**
 * Conversation
 * ────────────
 * One conversation is created per Order, automatically, when the order
 * is first placed. It holds the full message thread between buyer and seller.
 *
 * Message types:
 *   "text"   – a normal chat message
 *   "system" – an automated status-change event (not sent by either party)
 *   "offer"  – a price/terms counter-offer (future extension)
 */

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            // null for system messages
        },
        senderRole: {
            type: String,
            enum: ["buyer", "seller", "system"],
            required: true,
        },
        type: {
            type: String,
            enum: ["text", "system", "offer"],
            default: "text",
        },
        text: {
            type: String,
            trim: true,
            maxlength: 2000,
            required: true,
        },
        // For system messages: which status transition triggered this
        statusEvent: {
            type: String,
            enum: [
                "requested",
                "accepted",
                "rejected",
                "delivered",
                "completed",
                "cancelled",
                "disputed",
            ],
        },
        // Read receipts: array of userIds who have read this message
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const conversationSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            unique: true, // one conversation per order
            index: true,
        },
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // Snapshot so we can show conversation in inbox without populating order
        listingSnapshot: {
            title: String,
            image: String,
        },
        messages: [messageSchema],

        // Derived: last message text + time for inbox preview
        lastMessage: { type: String, default: "" },
        lastMessageAt: { type: Date, default: Date.now },

        // Per-user unread counts (embedded for quick badge rendering)
        unreadBuyer: { type: Number, default: 0 },
        unreadSeller: { type: Number, default: 0 },

        // Mirrors order status so the inbox can filter by it
        orderStatus: {
            type: String,
            enum: [
                "requested",
                "accepted",
                "rejected",
                "delivered",
                "completed",
                "cancelled",
                "disputed",
            ],
            default: "requested",
        },
    },
    { timestamps: true }
);

// Compound indexes for the inbox queries
conversationSchema.index({ buyer: 1, lastMessageAt: -1 });
conversationSchema.index({ seller: 1, lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);