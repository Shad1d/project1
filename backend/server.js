import dotenv from "dotenv";
dotenv.config(); // must be first so env vars are available everywhere

import dns from "dns";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import http from "http";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import pool from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import { initSocket } from "./socket/index.js";


// ── DNS override (keep your original setting) ──────────────────────────────────
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const app = express();
app.set("trust proxy", 1);
// ── Security headers ───────────────────────────────────────────────────────────
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false, // adjust when you add a frontend SSR layer
    })
);
// ── CORS ───────────────────────────────────────────────────────────────────────
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const originSources = process.env.ALLOWED_ORIGINS || clientUrl;
const allowedOrigins = originSources
    ? originSources.split(",").map((o) => o.trim())
    : [];

app.use(
    cors({
        origin: (origin, cb) => {
            // Allow requests with no origin (e.g. mobile apps, Postman in dev)
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    })
);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // reject oversized payloads
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// ── MongoDB query injection sanitiser ─────────────────────────────────────────
// Strips $ and . from user-supplied data before it reaches Mongoose
// currently not sanitizing query params, but can be added if needed
app.use((req, res, next) => {
    mongoSanitize.sanitize(req.body);
    mongoSanitize.sanitize(req.params);
    next();
});

// ── Logging ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

// ── Global rate limiter (fallback) ─────────────────────────────────────────────
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 2000,
        message: { error: "Too many requests from this IP, please try again later." },
        standardHeaders: true,
        legacyHeaders: false,
    })
);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/conversations", conversationRoutes);
// Serve uploaded images as static files
app.use("/uploads", express.static("uploads"));

// Health-check (useful for deployment probes)
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Create HTTP server (required for Socket.IO) ───────────────────────────────
const httpServer = http.createServer(app);

// ── Attach Socket.IO ──────────────────────────────────────────────────────────
const io = initSocket(httpServer);
app.set("io", io);  // ← makes io accessible in controllers via req.app.get("io")

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    });
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

await pool(); // connect to MongoDB first
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});