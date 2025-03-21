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

const router = express.Router();

// Authentication routes
router.get("/connect", connectInstagram);
router.get("/callback", instagramCallback);

// Account and Post routes
router.get("/account", getInstagramAccount);
router.get("/posts", getInstagramPosts);

// Automation routes
router.post("/automation", saveCommentAutomation);
router.get("/automation", getCommentAutomation);

// Webhook endpoint
router.all("/webhook", processWebhook);

export default router;
