import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    getInbox,
    getConversation,
    sendMessage,
    markRead,
    getUnreadCount,
    acceptOrderChat,
    rejectOrderChat,
    cancelOrderChat,
    deliverOrderChat,
    completeOrderChat,
    disputeOrderChat,
    submitReviewChat,
} from "../controllers/conversationController.js";

const router = express.Router();
router.use(protect);

// ── Inbox & unread ────────────────────────────────────────────────────────────
// GET  /api/conversations              → inbox list
router.get("/", getInbox);

// GET  /api/conversations/unread       → { unread: N } for nav badge
router.get("/unread", getUnreadCount);

// ── Per-order conversation ────────────────────────────────────────────────────
// GET  /api/conversations/order/:orderId          → full conversation + order
router.get("/order/:orderId", getConversation);

// POST /api/conversations/order/:orderId/messages → send a message
router.post("/order/:orderId/messages", sendMessage);

// PATCH /api/conversations/order/:orderId/read    → mark all read
router.patch("/order/:orderId/read", markRead);

// ── Order actions (emit socket + system message) ──────────────────────────────
router.patch("/order/:orderId/accept", acceptOrderChat);
router.patch("/order/:orderId/reject", rejectOrderChat);
router.patch("/order/:orderId/cancel", cancelOrderChat);
router.patch("/order/:orderId/deliver", deliverOrderChat);
router.patch("/order/:orderId/complete", completeOrderChat);
router.patch("/order/:orderId/dispute", disputeOrderChat);

// ── Review ────────────────────────────────────────────────────────────────────
router.post("/order/:orderId/review", submitReviewChat);

export default router;