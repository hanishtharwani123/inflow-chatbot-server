// models/CommentAutomation.ts
import mongoose, { Document, Schema } from "mongoose";

export interface ICommentAutomation extends Document {
  userId: string;
  postType: "specific" | "any" | "next";
  postId: string | null;
  commentTrigger: "specific" | "any";
  triggerWords: string[] | null;
  openingDM: string;
  linkDM: string | null;
  linkUrl: string | null;
  buttonLabel: string | null;
  autoReply: boolean;
  followUp: boolean;
  followRequest: boolean;
  emailRequest: boolean;
  isLive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentAutomationSchema = new Schema<ICommentAutomation>(
  {
    userId: { type: String, required: true },
    postType: {
      type: String,
      enum: ["specific", "any", "next"],
      required: true,
    },
    postId: { type: String, default: null },
    commentTrigger: { type: String, enum: ["specific", "any"], required: true },
    triggerWords: { type: [String], default: null },
    openingDM: { type: String, required: true },
    linkDM: { type: String, default: null },
    linkUrl: { type: String, default: null },
    buttonLabel: { type: String, default: null },
    autoReply: { type: Boolean, default: false },
    followUp: { type: Boolean, default: false },
    followRequest: { type: Boolean, default: false },
    emailRequest: { type: Boolean, default: false },
    isLive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<ICommentAutomation>(
  "CommentAutomation",
  CommentAutomationSchema
);
