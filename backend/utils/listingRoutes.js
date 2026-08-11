import express from "express";

import {
    createListing,
    getListingById,
    getNearbyListings,
    getListings,
    updateListing,
    deleteListing,
    updateListingsStatus,
    getMyListings
} from "../controllers/listingController.js";

import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getListings);
router.get("/nearby", protect, getNearbyListings);
router.get("/my", protect, getMyListings);
router.post("/", protect, upload.array("images", 6), createListing);

router.get("/:id", protect, getListingById);
router.patch("/:id", protect, updateListing);
router.patch("/:id/status", protect, updateListingsStatus);

router.delete("/:id", protect, deleteListing);

export default router;