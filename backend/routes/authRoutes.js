import express from "express";
import rateLimit from "express-rate-limit";
import {
    register,
    login,
    logout,
    getMe,
} from "../controllers/authController.js";
import { validateRegister, validateLogin } from "../middleware/validate.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes`
    max : 10,
    message: { error: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed login attempts
})

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
// standardHeader  ->  Sends standard HTTP rate - limit headers in the response, such as:
//                          - Remaining requests
//                          - Request limit
//                          - Time until the limit resets
//                     This helps clients know how many requests they have left.

// legacyHeaders  ->  Disables the old X - RateLimit headers, which are now deprecated and replaced by the standard headers.




router.post("/register", registerLimiter, validateRegister, register);

router.post("/login", loginLimiter, validateLogin, login);

router.post("/logout", protect, logout);

router.get("/me", protect, getMe);

export default router;