// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import { config } from "./config";
import instagramRoutes from "./routes/instagramRoutes";
import chatbotRoutes from "./routes/chatbotRoutes"; // Import chatbot routes

// Create Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: config.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Automation API is running", status: "healthy" });
});

// Routes
app.use("/api/instagram", instagramRoutes);
app.use("/api/chatbot", chatbotRoutes); // Add chatbot routes

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`Error occurred: ${err.message}`);
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong on the server.",
  });
});

// Validate config (optional but recommended)
const requiredConfig = ["MONGODB_URI", "CLIENT_URL", "API_URL", "REDIRECT_URI"];
for (const key of requiredConfig) {
  if (!config[key as keyof typeof config]) {
    console.error(`Missing required config: ${key}`);
    process.exit(1);
  }
}

// Connect to MongoDB
mongoose
  .connect(config.MONGODB_URI)
  .then(() => console.log(`Connected to MongoDB: ${config.MONGODB_URI}`))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Start server
const PORT = config.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API URL: ${config.API_URL}`);
  console.log(`Client URL: ${config.CLIENT_URL}`);
  console.log(`Redirect URI: ${config.REDIRECT_URI}`);
});

export default app;
