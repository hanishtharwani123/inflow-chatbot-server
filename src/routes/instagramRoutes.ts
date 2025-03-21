// src/routes/instagramRoutes.ts
import express from "express";
import {
  connectInstagram,
  instagramCallback,
  getInstagramAccount,
  getInstagramPosts,
  saveCommentAutomation,
  getCommentAutomation,
  processWebhook,
} from "../controllers/instagramController";
import { config } from "../config";

const router = express.Router();

// Authentication routes
router.get("/connect", connectInstagram);
router.get("/callback", instagramCallback);

// Account and Post routes (pass userId as query parameter)
router.get("/account", getInstagramAccount);
router.get("/posts", getInstagramPosts);

// Automation routes (pass userId as query parameter)
router.post("/automation", saveCommentAutomation);
router.get("/automation", getCommentAutomation);

// Webhook endpoint
router.get("/webhook", processWebhook);
router.post("/webhook", processWebhook);

export default router;
