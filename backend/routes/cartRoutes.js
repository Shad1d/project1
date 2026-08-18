import express from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);


// GET    /api/cart          → get current user's cart
router.get("/", getCart);

// POST   /api/cart/items    → add item to cart
router.post("/items", addToCart);

// PATCH  /api/cart/items/:itemId  → update quantity / rentalDays
router.patch("/items/:itemId", updateCartItem);

// DELETE /api/cart/items/:itemId  → remove one item
router.delete("/items/:itemId", removeCartItem);

// DELETE /api/cart          → clear entire cart
router.delete("/", clearCart);

export default router;