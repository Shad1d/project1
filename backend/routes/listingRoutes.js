import express from "express";

import {
    upload,
    createListing,
    getListingById,
    getNearbyListings,
    getListings,
    deleteListing,
    updateListingStatus,
    getMyListings
} from "../controllers/listingController.js";

import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

router.get("/", getListings);
router.get("/nearby", protect, getNearbyListings);
router.get("/my", protect, getMyListings);
router.post("/", protect, upload.array("images", 6), createListing);

router.get("/:id", protect, getListingById);
router.patch("/:id/status", protect, updateListingStatus);

router.delete("/:id", protect, deleteListing);

export default router;