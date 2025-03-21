// src/server.ts
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { config } from "./config";
import instagramRoutes from "./routes/instagramRoutes";

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

// Add basic endpoint for testing
app.get("/", (req, res) => {
  res.json({ message: "Instagram Automation API is running" });
});

// Routes
app.use("/api/instagram", instagramRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).send("Something went wrong!");
  }
);

// Connect to MongoDB
mongoose
  .connect(config.MONGODB_URI)
  .then(() => console.log(`Connected to MongoDB: ${config.MONGODB_URI}`))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = config.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API URL: ${config.API_URL}`);
  console.log(`Client URL: ${config.CLIENT_URL}`);
  console.log(`Redirect URI: ${config.REDIRECT_URI}`);
});

export default app;
