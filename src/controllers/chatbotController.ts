import { Request, Response } from "express";
import axios from "axios";
import OpenAI from "openai";
import ChatbotAutomation from "../models/ChatbotAutomation";
import SocialIntegration from "../models/SocialIntegration";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const FB_API_VERSION = "v22.0";
const WEBHOOK_VERIFY_TOKEN =
  process.env.WEBHOOK_VERIFY_TOKEN || "your-verify-token";

const getTempUserId = (req: Request): string => {
  return (req.query.userId as string) || "temp-user-123";
};

export const generateChatbot = async (req: Request, res: Response) => {
  const { task, context } = req.body;

  if (!task || !context) {
    return res.status(400).json({ error: "Task and context are required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional AI assistant designed to help with ${task}. Using this context: "${context}", generate:
          1. A short, friendly, and professional opening message (max 20 words).
          2. A detailed response template for the chatbot to use.
          Return the output as plain text with the opening message and response template separated by two newlines (\n\n). Do not include labels, headings, or extra text like "opening message" or "response sample"—just the raw content.`,
        },
        {
          role: "user",
          content:
            "Generate the opening message and response template based on the system instructions.",
        },
      ],
    });

    const aiResponse = response.choices[0].message.content;
    console.log("aiResponse: ", aiResponse);

    const [firstMessage, aiContent] = aiResponse?.split("\n\n") || [
      `Hi! I'm here to assist with ${task}. How can I help you today?`,
      `I'm designed to assist with ${task}. Based on your context: ${context}`,
    ];

    return res.json({
      firstMessage,
      aiContent,
    });
  } catch (error) {
    console.error("Error generating chatbot:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

export const saveChatbot = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);
  const { task, context, firstMessage, aiContent } = req.body;

  if (!task || !context || !firstMessage || !aiContent) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const automation = new ChatbotAutomation({
      userId,
      task,
      context,
      firstMessage,
      aiContent,
    });

    await automation.save();
    return res.json({
      message: "Chatbot saved successfully",
      id: automation._id,
    });
  } catch (error) {
    console.error("Error saving chatbot:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

export const previewResponse = async (req: Request, res: Response) => {
  const { context, task, message } = req.body;

  if (!context || !task || !message) {
    return res
      .status(400)
      .json({ error: "Context, task, and message are required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant designed to help with ${task}. Use this context: ${context}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const aiResponse =
      response.choices[0].message.content || "I'm here to assist you!";
    return res.json({ aiResponse });
  } catch (error) {
    console.error("Error generating preview response:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Get Instagram Account (reused from previous template)
export const getInstagramAccount = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  try {
    const integration = await SocialIntegration.findOne({
      userId,
      platform: "instagram",
    });
    if (!integration) {
      return res.status(404).json({ error: "Instagram account not connected" });
    }
    return res.json({
      username: integration.username,
      profilePicture: integration.profilePicture,
    });
  } catch (error) {
    console.error("Error fetching Instagram account:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Get Instagram Posts for Chatbot Template (reused logic with new endpoint)
export const getChatbotInstagramPosts = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  try {
    const integration = await SocialIntegration.findOne({
      userId,
      platform: "instagram",
    });
    if (!integration) {
      return res.status(404).json({ error: "Instagram account not connected" });
    }

    const { accessToken, pageToken, accountId } = integration;
    const response = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/media`,
      {
        params: {
          access_token: pageToken || accessToken,
          fields:
            "id,caption,media_url,thumbnail_url,permalink,media_type,timestamp",
          limit: 20,
        },
      }
    );

    return res.json({ posts: response.data.data || [] });
  } catch (error: any) {
    console.error(
      "Error fetching Instagram posts:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Failed to fetch Instagram posts" });
  }
};

// Save Chatbot automation settings
export const saveChatbotAutomation = async (req: Request, res: Response) => {
  const {
    userId,
    task,
    context,
    firstMessage,
    aiContent,
    postType,
    postId,
    commentTrigger,
    triggerWords,
    isLive,
  } = req.body;

  try {
    // Handle triggerWords: accept string or array, normalize to array
    let normalizedTriggerWords = null;
    if (triggerWords) {
      if (Array.isArray(triggerWords)) {
        normalizedTriggerWords = triggerWords.map((w: string) => w.trim());
      } else if (typeof triggerWords === "string") {
        normalizedTriggerWords = triggerWords
          .split(",")
          .map((w: string) => w.trim());
      }
    }

    const automation = await ChatbotAutomation.findOneAndUpdate(
      { userId },
      {
        userId,
        task,
        context,
        firstMessage,
        aiContent,
        postType,
        postId,
        commentTrigger,
        triggerWords: normalizedTriggerWords,
        isLive,
      },
      { upsert: true, new: true }
    );

    if (isLive) {
      await setupCommentWebhookHandler(userId);
    }

    return res.json({
      message: "Chatbot saved successfully",
      id: automation._id,
    });
  } catch (error) {
    console.error("Error saving chatbot:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Get current Chatbot automation settings
export const getChatbotAutomation = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  try {
    const automation = await ChatbotAutomation.findOne({ userId });
    console.log("automation: ", automation);
    if (!automation) {
      return res.status(404).json({ error: "No automation settings found" });
    }
    return res.json({ automation });
  } catch (error) {
    console.error("Error fetching chatbot automation settings:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch automation settings" });
  }
};

// Webhook Processing for Chatbot Template
export const processChatbotWebhook = async (req: Request, res: Response) => {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified");
      return res.status(200).send(challenge);
    }
    console.error("Webhook verification failed");
    return res.sendStatus(403);
  }

  if (req.method === "POST") {
    console.log("Webhook POST received");
    const { object, entry } = req.body;
    console.log("Full payload:", JSON.stringify(req.body, null, 2));

    if (!object || !entry) {
      console.error("Invalid payload: missing object or entry");
      return res.sendStatus(400);
    }

    if (object === "instagram") {
      console.log("Processing Instagram webhook");
      for (const event of entry) {
        if (event.changes) {
          for (const change of event.changes) {
            if (change.field === "comments" && change.value) {
              await handleChatbotCommentEvent(change.value);
            } else if (change.field === "messages" && change.value) {
              await handleChatbotMessageEvent(change.value);
            }
          }
        }
      }
    }
    return res.sendStatus(200);
  }
  return res.sendStatus(405);
};

// Setup webhook handler (reused logic)
const setupCommentWebhookHandler = async (userId: string) => {
  try {
    const integration = await SocialIntegration.findOne({
      userId,
      platform: "instagram",
    });
    if (!integration) throw new Error("Instagram integration not found");

    const { pageId, pageToken } = integration;
    await axios.post(
      `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/subscribed_apps`,
      { subscribed_fields: "comments,messages" },
      { params: { access_token: pageToken } }
    );
    console.log(
      `Successfully subscribed to comments and messages for user ${userId}`
    );
  } catch (error) {
    console.error("Error setting up webhook handler:", error);
    throw error;
  }
};

// Handle comment event for Chatbot
const handleChatbotCommentEvent = async (commentData: any) => {
  try {
    if (!commentData.verb || commentData.verb === "created") {
      const { id: commentId, text, from, media } = commentData;
      const commenterId = from.id;
      const mediaId = media.id;
      const ownerId =
        media?.owner?.id ||
        (
          await SocialIntegration.findOne({
            userId: "temp-user-123",
            platform: "instagram",
          })
        )?.accountId;

      const integration = await SocialIntegration.findOne({
        accountId: ownerId,
        platform: "instagram",
      });
      if (!integration) {
        console.log(`No integration found for account ${ownerId}`);
        return;
      }

      const userId = integration.userId;
      const automation = await ChatbotAutomation.findOne({
        userId,
        isLive: true,
      });
      if (!automation) {
        console.log(`No active automation found for user ${userId}`);
        return;
      }

      if (automation.postType === "specific" && automation.postId !== mediaId) {
        console.log(
          `Post ${mediaId} does not match automation post ${automation.postId}`
        );
        return;
      }

      if (
        automation.commentTrigger === "specific" &&
        automation.triggerWords &&
        !automation.triggerWords.some((word: string) =>
          text.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        console.log(
          `Comment "${text}" does not match trigger words: ${automation.triggerWords}`
        );
        return;
      }

      await processChatbotAutomation(
        automation,
        integration,
        commenterId,
        text
      );
    }
  } catch (error) {
    console.error("Error handling chatbot comment event:", error);
  }
};

// Handle message event for Chatbot (continues GPT chat)
const handleChatbotMessageEvent = async (messageData: any) => {
  try {
    console.log(
      "Processing message event:",
      JSON.stringify(messageData, null, 2)
    );
    const { sender, message } = messageData;
    const senderId = sender.id;

    const integration = await SocialIntegration.findOne({
      platform: "instagram",
    }); // Simplified, assumes one integration
    if (!integration) return;

    const userId = integration.userId;
    const automation = await ChatbotAutomation.findOne({
      userId,
      isLive: true,
    });
    if (!automation) return;

    const { task, context } = automation;

    // Generate GPT response based on user's message
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant designed to help with ${task}. Use this context: ${context}`,
        },
        { role: "user", content: message.text },
      ],
    });

    const aiResponse =
      response.choices[0].message.content || "How can I assist you further?";
    await sendDirectMessage(integration.pageToken, senderId, aiResponse);
  } catch (error) {
    console.error("Error handling chatbot message event:", error);
  }
};

// Process Chatbot automation (initial comment response)
const processChatbotAutomation = async (
  automation: any,
  integration: any,
  commenterId: string,
  initialComment: string
) => {
  try {
    const { pageToken } = integration;
    const { firstMessage, task, context } = automation;

    // Send GPT-generated opening DM
    await sendDirectMessage(pageToken, commenterId, firstMessage);

    // Generate initial GPT response based on comment
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant designed to help with ${task}. Use this context: ${context}`,
        },
        { role: "user", content: initialComment },
      ],
    });

    const aiResponse =
      response.choices[0].message.content || "How can I assist you further?";
    await sendDirectMessage(pageToken, commenterId, aiResponse);
  } catch (error) {
    console.error("Error processing chatbot automation:", error);
  }
};

// Send Direct Message (reused logic)
const sendDirectMessage = async (
  pageToken: string,
  userId: string,
  message: string
) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${FB_API_VERSION}/me/messages`,
      {
        recipient: { id: userId },
        message: { text: message },
      },
      { params: { access_token: pageToken } }
    );
    console.log(`DM sent successfully to ${userId}:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error sending DM:", error.response?.data || error.message);
    throw error;
  }
};
