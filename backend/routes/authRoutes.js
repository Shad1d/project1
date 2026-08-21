import express from "express";
import rateLimit from "express-rate-limit";
import {
    register,
    checkEmail,
    login,
    logout,
    getMe,
} from "../controllers/authController.js";
import { validateRegister, validateLogin } from "../middleware/validate.js";
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




router.post("/register", registerLimiter, validateRegister, register);

router.post("/login", loginLimiter, validateLogin, login);

router.post("/logout", protect, logout);

router.get("/me", protect, getMe);

export default router;