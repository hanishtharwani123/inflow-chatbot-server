// src/config.ts
import dotenv from "dotenv";

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/social-automation",

  // Facebook and Instagram API credentials
  FB_APP_ID: process.env.FB_APP_ID || "",
  FB_APP_SECRET: process.env.FB_APP_SECRET || "",

  // URLs
  API_URL: process.env.API_URL || "http://localhost:3000",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  REDIRECT_URI:
    process.env.REDIRECT_URI || "http://localhost:3000/api/instagram/callback",

  // Webhook configuration
  WEBHOOK_VERIFY_TOKEN:
    process.env.WEBHOOK_VERIFY_TOKEN || "my_secret_token_123",

  // Session secret
  SESSION_SECRET: process.env.SESSION_SECRET || "your_session_secret",
};
