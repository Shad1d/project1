import express from "express";

import {
    createListing,
} from "../controllers/listingController.js";

import {protect} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, upload.array("images", 6), createListing);