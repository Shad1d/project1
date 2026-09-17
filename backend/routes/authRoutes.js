import express from "express";
import rateLimit from "express-rate-limit";
import {
    register,
    verifyEmail,
    resendVerification,
    checkEmail,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
} from "../controllers/authController.js";
import { validateRegister, validateCheckEmail, validateLogin } from "../middleware/validate.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Rate limiters ──────────────────────────────────────────────────────────────

/**
 * Login limiter — strict, because this is the main brute-force target.
 * 10 attempts per IP per 15 minutes (complements per-account lockout).
 * Two layers: IP-level here + account-level in the controller.
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many login attempts from this IP. Please wait 15 minutes before trying again." },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests so the window only counts failures
    skipSuccessfulRequests: true,
});

/**
 * Strict limiter for registration — prevents bulk account creation / bots.
 * 5 attempts per IP per 15 minutes.
 */
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many registration attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Resend-verification limiter — prevents email flooding.
 * 3 attempts per IP per hour.
 */
const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: "Too many resend requests. Please wait an hour before trying again." },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General limiter for lightweight read endpoints.
 * 30 requests per IP per minute.
 */
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Routes ─────────────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post("/register", registerLimiter, validateRegister, register);

// POST /api/auth/login
router.post("/login", loginLimiter, validateLogin, login);

// POST /api/auth/logout  — requires a valid JWT
router.post("/logout", protect, logout);

// GET  /api/auth/me  — returns the current user's profile
router.get("/me", protect, getMe);

// PUT  /api/auth/profile  — updates the current user's profile
router.put("/profile", protect, updateProfile);

// PUT  /api/auth/change-password  — changes the current user's password
router.put("/change-password", protect, changePassword);

// GET  /api/auth/wishlist  — returns the current user's wishlist
router.get("/wishlist", protect, getWishlist);

// POST /api/auth/wishlist/:listingId  — adds a listing to the user's wishlist
router.post("/wishlist/:listingId", protect, addToWishlist);

// DELETE /api/auth/wishlist/:listingId  — removes a listing from the user's wishlist
router.delete("/wishlist/:listingId", protect, removeFromWishlist);

// GET  /api/auth/verify-email?token=<token>
router.get("/verify-email", generalLimiter, verifyEmail);

// POST /api/auth/resend-verification   body: { email }
router.post("/resend-verification", resendLimiter, resendVerification);

// GET  /api/auth/check-email/:email
router.get("/check-email/:email", generalLimiter, validateCheckEmail, checkEmail);

export default router;