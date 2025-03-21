// src/models/WebhookSubscription.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IWebhookSubscription extends Document {
  userId: string;
  platform: string;
  pageId: string;
  subscribedFields: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSubscriptionSchema = new Schema<IWebhookSubscription>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ["instagram", "facebook"],
    },
    pageId: {
      type: String,
      required: true,
    },
    subscribedFields: {
      type: [String],
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index for uniqueness
WebhookSubscriptionSchema.index(
  { userId: 1, platform: 1, pageId: 1 },
  { unique: true }
);

const WebhookSubscription = mongoose.model<IWebhookSubscription>(
  "WebhookSubscription",
  WebhookSubscriptionSchema
);

export default WebhookSubscription;
