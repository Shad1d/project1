import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import pool from "./config/db.js";
import dns from "dns";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listingRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setServers(["8.8.8.8", "1.1.1.1"])
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// Serve static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Fallback for missing uploaded files (e.g. legacy/deleted listings)
app.use("/uploads", (_req, res) => {
    const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <rect x="2" y="2" width="596" height="396" rx="8" fill="none" stroke="#e5e7eb" stroke-width="2"/>
      <circle cx="300" cy="160" r="35" fill="#e5e7eb"/>
      <path d="M280 185 C280 185 290 170 300 170 C310 170 320 185 320 185" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>
      <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="#6b7280">Image Unavailable</text>
    </svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(svgPlaceholder);
});

// ── Security headers ───────────────────────────────────────────────────────────
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false, // adjust when you add a frontend SSR layer
    })
);
// ── Logging ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

app.get("/", (req, res) => {
    res.send("Server is running!");
});

// req -> data sent from the client (frontend) to the server (backend)
// res -> data sent from the server (backend) to the client (frontend)

app.post("/api/greet", (req, res) => {
    const { name } = req.body;
    console.log(`Received name: ${name}`);
    res.json({ message: `Hello, ${name}! Welcome to Express` });
});

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/uploads", express.static("uploads"));

await pool()
app.listen(PORT, () => {
    console.log(`Server is running on port:${PORT}`);
});