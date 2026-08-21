import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    createOrder,
    createOrderFromCart,
    getBuyerOrders,
    getSellerOrders,
    getOrder,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    markDelivered,
    completeOrder,
    disputeOrder,
    submitReview,
} from "../controllers/orderController.js";

const router = express.Router();

router.use(protect);

// ── Create ────────────────────────────────────────────────────────────────────
// POST /api/orders              → direct "Request Item" from product page
router.post("/", createOrder);

// POST /api/orders/from-cart    → place order for one item in the cart
router.post("/from-cart", createOrderFromCart);

// ── Dashboards ────────────────────────────────────────────────────────────────
// GET /api/orders/buyer         → buyer's order history
router.get("/buyer", getBuyerOrders);

// GET /api/orders/seller        → seller's incoming orders
router.get("/seller", getSellerOrders);

// ── Single order ──────────────────────────────────────────────────────────────
// GET /api/orders/:orderId
router.get("/:orderId", getOrder);

// ── Status transitions ────────────────────────────────────────────────────────
// PATCH /api/orders/:orderId/accept    → seller accepts
router.patch("/:orderId/accept", acceptOrder);

// PATCH /api/orders/:orderId/reject    → seller rejects
router.patch("/:orderId/reject", rejectOrder);

// PATCH /api/orders/:orderId/cancel    → buyer or seller cancels
router.patch("/:orderId/cancel", cancelOrder);

// PATCH /api/orders/:orderId/deliver   → seller marks as delivered
router.patch("/:orderId/deliver", markDelivered);

// PATCH /api/orders/:orderId/complete  → buyer confirms receipt
router.patch("/:orderId/complete", completeOrder);

// PATCH /api/orders/:orderId/dispute   → open a dispute
router.patch("/:orderId/dispute", disputeOrder);

// ── Review ────────────────────────────────────────────────────────────────────
// POST /api/orders/:orderId/review     → buyer submits review after completion
router.post("/:orderId/review", submitReview);

export default router;