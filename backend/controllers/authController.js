import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Listing from "../models/listing.js";
import User from "../models/user.js";
import { sendVerificationEmail } from "../utils/sendEmail.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Signs a JWT for the given user id.
 */
const signToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

/**
 * Generates a secure random hex token and its SHA-256 hash.
 * The raw token goes in the email link; only the hash is stored in the DB
 * so that if the DB is compromised the tokens can't be used.
 */
const generateVerificationToken = () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, hashedToken };
};

// ── Controllers ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * 1. Check if email already exists
 * 2. Create user (password hashed via pre-save hook in User model)
 * 3. Generate email-verification token
 * 4. Send verification email
 * 5. Return success (do NOT log the user in yet — require email verification)
 */
export const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, phoneNumber, address, location } =
            req.sanitised; // set by validateRegister middleware

        // ── Duplicate email check ─────────────────────────────────────────────
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "Email is already registered" });
        }

        // ── Build GeoJSON point ───────────────────────────────────────────────
        // Frontend sends { lat, lng }; GeoJSON stores [longitude, latitude]
        const geoLocation = {
            type: "Point",
            coordinates: [parseFloat(location.lng), parseFloat(location.lat)],
        };

        // ── Generate verification token ───────────────────────────────────────
        const { rawToken, hashedToken } = generateVerificationToken();
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // ── Create user ───────────────────────────────────────────────────────
        const user = await User.create({
            firstName,
            lastName,
            email,
            password,          // hashed by pre-save hook
            phoneNumber,
            address,
            location: geoLocation,
            emailVerificationToken: hashedToken,
            emailVerificationTokenExpires: tokenExpires,
        });

        // ── Send verification email ───────────────────────────────────────────
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;

        try {
            await sendVerificationEmail(email, firstName, verifyUrl);
        } catch (emailError) {
            // Email sending failed — user is created but not yet verified.
            // We still respond with success and tell the user to check their email.
            // Log the error server-side.
            console.error("Failed to send verification email:", emailError.message);
        }

        // ── Respond ───────────────────────────────────────────────────────────
        return res.status(201).json({
            message:
                "Account created successfully! Please check your email to verify your account before logging in.",
            user: user.toSafeObject(),
        });
    } catch (error) {
        console.error("Register error:", error);

        // Handle Mongoose duplicate key (race condition fallback)
        if (error.code === 11000) {
            return res.status(409).json({ error: "Email is already registered" });
        }

        // Handle Mongoose validation errors
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).reduce((acc, e) => {
                acc[e.path] = e.message;
                return acc;
            }, {});
            return res.status(422).json({ errors });
        }

        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * GET /api/auth/verify-email?token=<rawToken>
 *
 * Validates the token, marks the user as verified, and issues a JWT
 * so the user is logged in immediately after verifying.
 */
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: "Verification token is missing" });
        }

        // Hash the incoming raw token and look it up
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationTokenExpires: { $gt: Date.now() }, // not expired
        }).select("+emailVerificationToken +emailVerificationTokenExpires");

        if (!user) {
            return res.status(400).json({
                error: "Verification link is invalid or has expired. Please request a new one.",
            });
        }

        // Mark user as verified and clear the token fields
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        user.lastLogin = new Date();
        await user.save();

        // Issue JWT — user is now logged in
        const jwtToken = signToken(user._id);

        return res.status(200).json({
            message: "Email verified successfully! Welcome to GrocCart.",
            token: jwtToken,
            user: user.toSafeObject(),
        });
    } catch (error) {
        console.error("Verify email error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * POST /api/auth/resend-verification
 *
 * Resends a fresh verification email for accounts that haven't verified yet.
 * Rate-limited to prevent abuse (via express-rate-limit on the route).
 */
export const resendVerification = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase().trim();

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const user = await User.findOne({ email }).select(
            "+emailVerificationToken +emailVerificationTokenExpires"
        );

        // Always respond the same way to prevent email enumeration attacks
        const genericMsg =
            "If that email address is registered and unverified, a new verification link has been sent.";

        if (!user || user.isEmailVerified) {
            return res.status(200).json({ message: genericMsg });
        }

        // Generate a new token
        const { rawToken, hashedToken } = generateVerificationToken();
        user.emailVerificationToken = hashedToken;
        user.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;

        try {
            await sendVerificationEmail(email, user.firstName, verifyUrl);
        } catch (emailError) {
            console.error("Failed to resend verification email:", emailError.message);
        }

        return res.status(200).json({ message: genericMsg });
    } catch (error) {
        console.error("Resend verification error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * GET /api/auth/check-email/:email
 *
 * Used by the frontend for real-time duplicate email checking.
 * Responds with { available: boolean }.
 */
export const checkEmail = async (req, res) => {
    try {
        const email = req.sanitisedEmail; // set by validateCheckEmail middleware
        const user = await User.findOne({ email }).select("_id").lean();
        return res.status(200).json({ available: !user });
    } catch (error) {
        console.error("Check email error:", error);
        return res.status(500).json({ error: "Server error" });
    }
};

// ── Constants for account lockout ──────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;           // lock after 5 consecutive failures
const LOCK_DURATION_MS = 15 * 60 * 1000; // locked for 15 minutes

/**
 * POST /api/auth/login
 *
 * Security measures applied:
 *  1. Input validation via middleware (validateLogin)
 *  2. Rate limiting on the route (loginLimiter — 10 attempts / 15 min per IP)
 *  3. Account-level lockout after MAX_LOGIN_ATTEMPTS consecutive failures
 *  4. bcrypt.compare runs even when user not found (prevents timing-based
 *     email enumeration — attacker can't tell valid vs invalid email by response time)
 *  5. Generic error message — never reveals whether the email exists
 *  6. Blocks unverified accounts from logging in
 *  7. JWT issued only on full success; lastLogin updated
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.sanitised; // set by validateLogin middleware

        // ── Fetch user, explicitly selecting hidden security fields ────────────
        const user = await User.findOne({ email }).select(
            "+password +loginAttempts +lockUntil"
        );

        // ── Constant-time dummy compare when user not found ───────────────────
        // bcrypt.compare takes the same time whether or not the user exists,
        // preventing timing attacks that reveal valid email addresses.
        if (!user) {
            await bcryptDummyCompare();
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // ── Account lockout check ─────────────────────────────────────────────
        if (user.isLocked()) {
            const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60_000);
            return res.status(423).json({
                error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`,
            });
        }

        // ── Email verification check ──────────────────────────────────────────
        if (!user.isEmailVerified) {
            return res.status(403).json({
                error: "Please verify your email address before logging in. Check your inbox or request a new verification link.",
                code: "EMAIL_NOT_VERIFIED",
            });
        }

        // ── Account active check ──────────────────────────────────────────────
        if (!user.isActive) {
            return res.status(403).json({ error: "This account has been deactivated. Please contact support." });
        }

        // ── Password comparison ───────────────────────────────────────────────
        const passwordMatch = await user.comparePassword(password);

        if (!passwordMatch) {
            await handleFailedLogin(user);
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // ── Successful login — reset lockout counters ─────────────────────────
        if (user.loginAttempts > 0 || user.lockUntil) {
            user.loginAttempts = 0;
            user.lockUntil = undefined;
        }
        user.lastLogin = new Date();
        await user.save();

        // ── Issue JWT ─────────────────────────────────────────────────────────
        const token = signToken(user._id);

        return res.status(200).json({
            message: "Login successful.",
            token,
            user: user.toSafeObject(),
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * POST /api/auth/logout
 *
 * JWTs are stateless — the real logout happens on the client by discarding
 * the token (AuthContext.logout() already does this).
 * This endpoint exists so the server can log the event and,
 * in the future, support a token-revocation blocklist if needed.
 */
export const logout = async (req, res) => {
    try {
        // req.user is set by the `protect` middleware
        console.log(`User ${req.user._id} logged out at ${new Date().toISOString()}`);

        // Future enhancement: add token jti to a Redis blocklist here.

        return res.status(200).json({ message: "Logged out successfully." });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile.
 * Protected by the `protect` middleware.
 */
export const getMe = async (req, res) => {
    try {
        // req.user is already loaded by `protect` — just return it
        return res.status(200).json({ user: req.user.toSafeObject() });
    } catch (error) {
        console.error("getMe error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * GET /api/auth/wishlist
 *
 * Returns the authenticated user's wishlist with listing documents populated.
 */
export const getWishlist = async (req, res) => {
    try {
        await req.user.populate({
            path: "wishlist",
            populate: {
                path: "seller",
                select: "firstName lastName",
            },
        });

        const wishlist = req.user.wishlist.filter(Boolean);

        return res.status(200).json({
            wishlist,
            count: wishlist.length,
            user: req.user.toSafeObject(),
        });
    } catch (error) {
        console.error("getWishlist error:", error);
        return res.status(500).json({ error: "Failed to fetch wishlist." });
    }
};

/**
 * POST /api/auth/wishlist/:listingId
 *
 * Adds a listing to the current user's wishlist if it is not already present.
 */
export const addToWishlist = async (req, res) => {
    try {
        const { listingId } = req.params;

        if (!mongoose.isValidObjectId(listingId)) {
            return res.status(400).json({ error: "Invalid listing id." });
        }

        const listing = await Listing.findById(listingId).select("_id");
        if (!listing) {
            return res.status(404).json({ error: "Listing not found." });
        }

        const alreadySaved = req.user.wishlist.some((item) => item.toString() === listingId);
        if (!alreadySaved) {
            req.user.wishlist.push(listing._id);
            await req.user.save();
        }

        await req.user.populate({
            path: "wishlist",
            populate: {
                path: "seller",
                select: "firstName lastName",
            },
        });

        const wishlist = req.user.wishlist.filter(Boolean);

        return res.status(200).json({
            message: alreadySaved ? "Listing is already in wishlist." : "Listing added to wishlist.",
            wishlist,
            count: wishlist.length,
            user: req.user.toSafeObject(),
        });
    } catch (error) {
        console.error("addToWishlist error:", error);
        return res.status(500).json({ error: "Failed to add listing to wishlist." });
    }
};

/**
 * DELETE /api/auth/wishlist/:listingId
 *
 * Removes a listing from the current user's wishlist.
 */
export const removeFromWishlist = async (req, res) => {
    try {
        const { listingId } = req.params;

        if (!mongoose.isValidObjectId(listingId)) {
            return res.status(400).json({ error: "Invalid listing id." });
        }

        const beforeCount = req.user.wishlist.length;
        req.user.wishlist = req.user.wishlist.filter((item) => item.toString() !== listingId);

        if (req.user.wishlist.length !== beforeCount) {
            await req.user.save();
        }

        await req.user.populate({
            path: "wishlist",
            populate: {
                path: "seller",
                select: "firstName lastName",
            },
        });

        const wishlist = req.user.wishlist.filter(Boolean);

        return res.status(200).json({
            message: "Listing removed from wishlist.",
            wishlist,
            count: wishlist.length,
            user: req.user.toSafeObject(),
        });
    } catch (error) {
        console.error("removeFromWishlist error:", error);
        return res.status(500).json({ error: "Failed to remove listing from wishlist." });
    }
};

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Runs a dummy bcrypt compare so code paths for "user not found" and
 * "wrong password" take the same amount of time, preventing timing attacks.
 */
const bcryptDummyCompare = async () => {
    // A pre-hashed dummy — bcrypt.compare will always return false.
    const DUMMY_HASH = "$2b$12$invalidhashthatisjustheretowastetimedummyhashXXXXXXXXX";
    const { default: bcrypt } = await import("bcryptjs");
    await bcrypt.compare("dummy_password_to_prevent_timing_attack", DUMMY_HASH);
};

/**
 * Increments failed login attempts and locks the account when the threshold
 * is reached. Saves to DB.
 */
const handleFailedLogin = async (user) => {
    user.loginAttempts += 1;

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.loginAttempts = 0; // reset counter so next window starts fresh after unlock
        console.warn(`Account locked: ${user.email} after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
    }

    await user.save();
};