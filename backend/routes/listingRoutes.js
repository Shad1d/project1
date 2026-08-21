import express from "express";
import {
    upload,
    createListing,
    getListings,
    getListingById,
    updateListingStatus,
    deleteListing,
    getMyListings,
    getNearbyListings,
} from "../controllers/listingController.js";
import {protect} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getListings);
router.get("/my", protect, getMyListings);
router.get("/nearby", protect, getNearbyListings);
router.post("/", protect, upload.array("images",6), createListing);

router.get("/:id", getListingById);
router.patch("/:id/status" , protect, updateListingStatus);
// patch -> update the status of a listing (e.g., from "available" to "sold")
router.delete("/:id", protect, deleteListing);

export default router;