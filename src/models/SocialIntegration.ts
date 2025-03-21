// src/models/SocialIntegration.ts
import mongoose, { Document, Schema } from "mongoose";

export interface ISocialIntegration extends Document {
  userId: string;
  platform: string;
  accountId: string;
  username: string;
  profilePicture?: string;
  accessToken: string;
  pageId?: string;
  pageToken?: string;
  tokenExpiry: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SocialIntegrationSchema = new Schema<ISocialIntegration>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: [
        "instagram",
        "facebook",
        "linkedin",
        "twitter",
        "tiktok",
        "whatsapp",
        "telegram",
      ],
    },
    accountId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
    },
    accessToken: {
      type: String,
      required: true,
    },
    pageId: {
      type: String,
    },
    pageToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
      required: true,
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
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness
SocialIntegrationSchema.index(
  { userId: 1, platform: 1, accountId: 1 },
  { unique: true }
);

const SocialIntegration = mongoose.model<ISocialIntegration>(
  "SocialIntegration",
  SocialIntegrationSchema
);

export default SocialIntegration;
