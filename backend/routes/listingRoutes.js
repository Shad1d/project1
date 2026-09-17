import express from "express";
import {
    upload,
    createListing,
    getListings,
    searchListings,
    getListingById,
    getMyListings,
    getNearbyListings,
    updateListingStatus,
    deleteListing,
} from "../controllers/listingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/", getListings);
router.get("/search", searchListings);

// ── Protected (static paths — must come before /:id) ─────────────────────────
router.get("/my", protect, getMyListings);
router.get("/nearby", protect, getNearbyListings);
router.post("/", protect, upload.array("images", 6), createListing);

// ── Public + Protected (dynamic :id paths) ───────────────────────────────────
router.get("/:id", getListingById);
router.patch("/:id/status", protect, updateListingStatus);
router.delete("/:id", protect, deleteListing);

export default router;