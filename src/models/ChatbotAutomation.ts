import mongoose, { Schema, Document } from "mongoose";

export interface IChatbotAutomation extends Document {
  userId: string;
  task: string; // The task the chatbot is designed to assist with (e.g., "scheduling appointments")
  context: string; // Business context for GPT to use (e.g., "We offer fitness coaching via Zoom...")
  firstMessage: string; // GPT-generated opening DM
  aiContent: string; // GPT-generated knowledge base for follow-up responses
  postType: "specific" | "all"; // Whether automation targets a specific post or all posts/reels
  postId: string | null; // ID of the specific post (null if postType is "all")
  commentTrigger: "specific" | "all"; // Whether to trigger on specific keywords or all comments
  triggerWords: string[] | null; // List of keywords to trigger automation (null if "all")
  isLive: boolean; // Whether the automation is currently active
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotAutomationSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true, // For faster lookups by user
    },
    task: {
      type: String,
      required: true,
    },
    context: {
      type: String,
      required: true,
    },
    firstMessage: {
      type: String,
      required: true,
    },
    aiContent: {
      type: String,
      required: true,
    },
    postType: {
      type: String,
      enum: ["specific", "all"],
      required: true,
    },
    postId: {
      type: String,
      default: null,
    },
    commentTrigger: {
      type: String,
      enum: ["specific", "all"],
      required: true,
    },
    triggerWords: {
      type: [String],
      default: null,
    },
    isLive: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ensure uniqueness for userId to prevent duplicate automations per user
ChatbotAutomationSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model<IChatbotAutomation>(
  "ChatbotAutomation",
  ChatbotAutomationSchema
);
