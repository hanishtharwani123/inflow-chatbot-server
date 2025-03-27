import express from "express";
import {
  generateChatbot,
  saveChatbot,
  previewResponse,
  saveChatbotAutomation,
  getChatbotAutomation,
  getInstagramAccount,
  getChatbotInstagramPosts,
  processChatbotWebhook,
} from "../controllers/chatbotController";

const router = express.Router();

router.post("/generate", generateChatbot);
router.post("/preview-response", previewResponse);
router.post("/automation", saveChatbotAutomation);
router.get("/automation", getChatbotAutomation);
router.get("/account", getInstagramAccount);
router.get("/posts", getChatbotInstagramPosts);
router.all("/webhook", processChatbotWebhook);
export default router;
