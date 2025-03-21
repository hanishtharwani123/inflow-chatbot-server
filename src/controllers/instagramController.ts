// src/controllers/instagramController.ts
import { Request, Response } from "express";
import axios from "axios";
import SocialIntegration from "../models/SocialIntegration";
import CommentAutomation from "../models/CommentAutomation";
import WebhookSubscription from "../models/WebhookSubscription";
import { config } from "../config";

// Environment variables
const FB_APP_ID = config.FB_APP_ID;
const FB_APP_SECRET = config.FB_APP_SECRET;
const REDIRECT_URI = config.REDIRECT_URI; // e.g., http://localhost:3000/api/instagram/callback
const CLIENT_URL = config.CLIENT_URL; // e.g., http://localhost:5173
const FB_API_VERSION = "v22.0";
const WEBHOOK_VERIFY_TOKEN = config.WEBHOOK_VERIFY_TOKEN;

// Add this temporary auth middleware replacement since you mentioned no auth is needed yet
const getTempUserId = (req: Request): string => {
  // Using a fixed temporary user ID for demonstration
  return (req.query.userId as string) || "temp-user-123";
};

// Step 1: Redirect user to Instagram authorization
export const connectInstagram = (req: Request, res: Response) => {
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement&response_type=code`;

  res.redirect(authUrl);
};

export const instagramCallback = async (req: Request, res: Response) => {
  const { code } = req.query;
  console.log("Authorization code received:", code);

  const userId = getTempUserId(req);

  if (!code) {
    console.error("Missing authorization code");
    return res.redirect(
      `${CLIENT_URL}/connect-platform/instagram?integration=failed&reason=missing_code`
    );
  }

  try {
    // Step 1: Exchange code for short-lived access token
    console.log("Attempting to exchange code for access token...");
    console.log(`Redirect URI: ${REDIRECT_URI}`);
    const tokenUrl = `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`;
    console.log(`Token URL: ${tokenUrl}`);

    const tokenParams = {
      client_id: FB_APP_ID,
      redirect_uri: REDIRECT_URI,
      client_secret: FB_APP_SECRET,
      code: code as string,
    };

    console.log("Token request params:", JSON.stringify(tokenParams, null, 2));

    const tokenResponse = await axios.get(tokenUrl, { params: tokenParams });
    console.log("Token response received:", tokenResponse.status);

    const shortLivedToken = tokenResponse.data.access_token;
    if (!shortLivedToken) {
      throw new Error("No short-lived token received");
    }
    console.log("Short-lived token obtained");

    // Step 2: Exchange for long-lived token
    console.log("Exchanging for long-lived token...");
    const longLivedTokenResponse = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: FB_APP_ID,
          client_secret: FB_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        },
      }
    );

    const longLivedToken = longLivedTokenResponse.data.access_token;
    if (!longLivedToken) {
      throw new Error("No long-lived token received");
    }
    console.log("Long-lived token obtained");

    // Step 3: Get user's Facebook Pages
    console.log("Fetching Facebook pages...");
    const pagesResponse = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/me/accounts`,
      {
        params: {
          access_token: longLivedToken,
          fields: "id,name,access_token",
        },
      }
    );

    const pages = pagesResponse.data.data;
    if (!pages || pages.length === 0) {
      console.error("No Facebook pages found:", pagesResponse.data);
      return res.redirect(
        `${CLIENT_URL}/connect-platform/instagram?integration=failed&reason=no_facebook_pages`
      );
    }
    console.log(`Found ${pages.length} Facebook pages`);

    // Step 4: Find Instagram Business Account
    let instagramAccountId: string | null = null;
    let pageToken: string | null = null;
    let pageId: string | null = null;
    let username: string | null = null;
    let profilePicture: string | null = null;

    console.log("Looking for Instagram Business account...");
    for (const page of pages) {
      pageToken = page.access_token;
      pageId = page.id;
      console.log(`Checking page ${page.id} - ${page.name || "unnamed"}`);

      const instagramAccountResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/${page.id}`,
        {
          params: {
            fields: "instagram_business_account",
            access_token: pageToken,
          },
        }
      );

      if (instagramAccountResponse.data.instagram_business_account?.id) {
        instagramAccountId =
          instagramAccountResponse.data.instagram_business_account.id;
        console.log(`Found Instagram Business account: ${instagramAccountId}`);

        // Step 5: Get Instagram account details
        const accountDetailsResponse = await axios.get(
          `https://graph.facebook.com/${FB_API_VERSION}/${instagramAccountId}`,
          {
            params: {
              fields: "username,profile_picture_url",
              access_token: pageToken,
            },
          }
        );

        username = accountDetailsResponse.data.username;
        profilePicture = accountDetailsResponse.data.profile_picture_url;
        break;
      }
    }

    if (!instagramAccountId) {
      console.error("No Instagram Business account found");
      return res.redirect(
        `${CLIENT_URL}/connect-platform/instagram?integration=failed&reason=no_instagram_account`
      );
    }

    // Step 6: Store credentials in database
    console.log("Storing credentials in database...");
    await SocialIntegration.findOneAndUpdate(
      { userId, platform: "instagram", accountId: instagramAccountId },
      {
        accessToken: longLivedToken,
        pageId,
        pageToken,
        username,
        profilePicture,
        tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Step 7: Set up webhooks
    console.log("Setting up webhooks...");
    await setupInstagramWebhooks(userId, pageId!, pageToken!);

    // Step 8: Redirect to success
    console.log(`Successfully connected Instagram account: ${username}`);
    return res.redirect(`${CLIENT_URL}/success/instagram?username=${username}`);
  } catch (error: any) {
    console.error(
      "Instagram auth error:",
      error.response?.data || error.message
    );
    const errorReason = error.response?.data?.error?.message
      ? encodeURIComponent(error.response.data.error.message)
      : "unknown_error";
    return res.redirect(
      `${CLIENT_URL}/connect-platform/instagram?integration=failed&reason=${errorReason}`
    );
  }
};

// Get user's Instagram account details
export const getInstagramAccount = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

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

// Get user's Instagram posts
export const getInstagramPosts = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const integration = await SocialIntegration.findOne({
      userId,
      platform: "instagram",
    });
    console.log("integration: ", integration);

    if (!integration) {
      return res.status(404).json({ error: "Instagram account not connected" });
    }

    // Use 'accountId' instead of 'instagramAccountId'
    const { accessToken, pageToken, accountId } = integration;

    // Fetch posts from Instagram Graph API
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

    const posts = response.data.data || [];
    console.log("posts :", posts);

    return res.json({ posts });
  } catch (error: any) {
    console.error(
      "Error fetching Instagram posts:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Failed to fetch Instagram posts" });
  }
};

// Save comment automation settings
export const saveCommentAutomation = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const {
      postType,
      selectedPost,
      commentTrigger,
      commentWords,
      openingDM,
      linkDM,
      linkUrl,
      buttonLabel,
      autoReply,
      followUp,
      followRequest,
      emailRequest,
      isLive,
    } = req.body;

    // Validate required fields
    if (!postType || !commentTrigger || !openingDM) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // If postType is specific, ensure a post is selected
    if (postType === "specific" && !selectedPost) {
      return res.status(400).json({ error: "Please select a post" });
    }

    // If commentTrigger is specific, ensure words are provided
    if (
      commentTrigger === "specific" &&
      (!commentWords || commentWords.trim() === "")
    ) {
      return res.status(400).json({ error: "Please provide trigger words" });
    }

    // Process trigger words if provided
    const triggerWords =
      commentTrigger === "specific" && commentWords
        ? commentWords
            .split(",")
            .map((word: string) => word.trim())
            .filter((word: string) => word !== "")
        : null;

    // Create or update automation settings
    const automation = await CommentAutomation.findOneAndUpdate(
      { userId },
      {
        userId,
        postType,
        postId: postType === "specific" ? selectedPost : null,
        commentTrigger,
        triggerWords,
        openingDM,
        linkDM: linkDM || null,
        linkUrl: linkUrl || null,
        buttonLabel: buttonLabel || null,
        autoReply,
        followUp,
        followRequest,
        emailRequest,
        isLive,
      },
      { upsert: true, new: true }
    );

    // If automation is set to live, set up webhook handler
    if (isLive) {
      await setupCommentWebhookHandler(userId);
    }

    return res.status(200).json({
      message: "Comment automation saved successfully",
      automation,
    });
  } catch (error: any) {
    console.error("Error saving comment automation:", error);
    return res
      .status(500)
      .json({ error: "Failed to save automation settings" });
  }
};

// Get current automation settings
export const getCommentAutomation = async (req: Request, res: Response) => {
  const userId = getTempUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const automation = await CommentAutomation.findOne({ userId });
    console.log("automation :", automation);
    if (!automation) {
      return res.status(404).json({ error: "No automation settings found" });
    }

    return res.json({ automation });
  } catch (error) {
    console.error("Error fetching automation settings:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch automation settings" });
  }
};

// Set up webhook handler for comments
const setupCommentWebhookHandler = async (userId: string) => {
  try {
    const integration = await SocialIntegration.findOne({
      userId,
      platform: "instagram",
    });

    if (!integration) throw new Error("Instagram integration not found");

    const { pageId, pageToken } = integration;
    if (!pageId || !pageToken) throw new Error("Missing page ID or token");

    await axios.post(
      `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/subscribed_apps`,
      {
        subscribed_fields: "comments", // Updated to v22.0
      },
      {
        params: { access_token: pageToken },
      }
    );

    console.log(`Successfully subscribed to comments for user ${userId}`);
  } catch (error) {
    console.error("Error setting up comment webhook handler:", error);
    throw error;
  }
};

export const setupInstagramWebhooks = async (
  userId: string,
  pageId: string,
  pageToken: string
) => {
  try {
    console.log("Setting up Instagram webhooks...");
    const response = await axios.post(
      `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/subscribed_apps`,
      {
        subscribed_fields: ["comments", "messages"], // Updated to v22.0 fields
      },
      {
        params: { access_token: pageToken },
      }
    );

    console.log("Subscription response:", response.data);
    if (response.data.success) {
      console.log(`Successfully subscribed to webhooks for page ${pageId}`);
    } else {
      console.error("Failed to subscribe to webhooks:", response.data);
      throw new Error("Webhook subscription failed");
    }

    await WebhookSubscription.findOneAndUpdate(
      { userId, platform: "instagram", pageId },
      {
        userId,
        platform: "instagram",
        pageId,
        subscribedFields: ["comments", "messages"],
        active: true,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return true;
  } catch (error: any) {
    console.error(
      "Error setting up Instagram webhooks:",
      error.response?.data || error.message
    );
    return false;
  }
};

export const processWebhook = async (req: Request, res: Response) => {
  if (req.method === "GET") {
    const verifyToken = WEBHOOK_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified");
      return res.status(200).send(challenge);
    } else {
      console.error("Webhook verification failed");
      return res.sendStatus(403);
    }
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
        console.log("Entry:", JSON.stringify(event, null, 2));
        if (event.changes) {
          for (const change of event.changes) {
            console.log("Change:", JSON.stringify(change, null, 2));
            if (change.field === "comments" && change.value) {
              await handleCommentEvent(change.value);
            } else if (change.field === "messages" && change.value) {
              await handleMessageEvent(change.value);
            } else {
              console.log(`Unhandled field: ${change.field}`);
            }
          }
        } else {
          console.log("No changes in event");
        }
      }
    } else {
      console.log(`Ignoring non-Instagram webhook: ${object}`);
    }
    return res.sendStatus(200);
  }

  return res.sendStatus(405);
};

const handleCommentEvent = async (commentData: any) => {
  try {
    console.log(
      "Processing comment event:",
      JSON.stringify(commentData, null, 2)
    );

    // Handle both test events (no verb) and real events (verb: "created")
    if (!commentData.verb || commentData.verb === "created") {
      const { id: commentId, text, from, media } = commentData;
      console.log(
        `Comment ID: ${commentId}, Text: ${text}, From: ${from.id}, Media ID: ${media.id}`
      );
      const commenterId = from.id;
      const mediaId = media.id;

      let ownerId = media?.owner?.id;
      if (!ownerId) {
        console.warn(
          "Missing media.owner.id, attempting to fetch or use default"
        );
        // For test events, assume the integrated account; for real events, fetch if needed
        const integrationFallback = await SocialIntegration.findOne({
          userId: "temp-user-123",
          platform: "instagram",
        });
        ownerId = integrationFallback?.accountId; // "17841451099257997"
        if (!ownerId) {
          console.error("No owner ID available, aborting");
          return;
        }
      }

      const integration = await SocialIntegration.findOne({
        accountId: ownerId,
        platform: "instagram",
      });

      if (!integration) {
        console.log(`No integration found for account ${ownerId}`);
        return;
      }

      const userId = integration.userId;
      console.log(`Found integration for user ${userId}`);

      const automation = await CommentAutomation.findOne({
        userId,
        isLive: true,
      });

      if (!automation) {
        console.log(`No active automation found for user ${userId}`);
        return;
      }

      console.log("Automation settings:", automation);

      if (automation.postType === "specific" && automation.postId !== mediaId) {
        console.log(
          `Post ${mediaId} does not match automation post ${automation.postId}`
        );
        return;
      }

      if (
        automation.commentTrigger === "specific" &&
        automation.triggerWords &&
        !automation.triggerWords.some((word) =>
          text.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        console.log(
          `Comment "${text}" does not match trigger words: ${automation.triggerWords}`
        );
        return;
      }

      await processAutomation(
        automation,
        integration,
        commenterId,
        commentId,
        text
      );
    } else {
      console.log(`Ignoring comment event with verb: ${commentData.verb}`);
    }
  } catch (error) {
    console.error("Error handling comment event:", error);
  }
};

const handleMessageEvent = async (messageData: any) => {
  try {
    console.log(
      "Processing message event:",
      JSON.stringify(messageData, null, 2)
    );
    // Placeholder for DM handling
  } catch (error) {
    console.error("Error handling message event:", error);
  }
};

const processAutomation = async (
  automation: any,
  integration: any,
  commenterId: string,
  commentId: string,
  commentText: string
) => {
  try {
    const { pageToken } = integration;

    if (automation.openingDM) {
      await sendDirectMessage(pageToken, commenterId, automation.openingDM);
      console.log(`Sent opening DM to ${commenterId}`);
    }

    if (automation.linkDM && automation.linkUrl) {
      const linkMessage = `${automation.linkDM}\n\n${automation.linkUrl}`;
      await sendDirectMessage(pageToken, commenterId, linkMessage);
      console.log(`Sent link DM to ${commenterId}`);
    }

    if (automation.autoReply) {
      const replyText =
        "Thanks for your comment! Check your DMs for more info.";
      await replyToComment(pageToken, commentId, replyText);
      console.log(`Replied to comment ${commentId}`);
    }

    if (automation.followUp) {
      console.log(
        `Follow-up scheduled for ${commenterId} (implement with queue)`
      );
    }

    if (automation.followRequest) {
      const followMessage = "Hey! Follow me for more updates!";
      await sendDirectMessage(pageToken, commenterId, followMessage);
      console.log(`Sent follow request DM to ${commenterId}`);
    }

    if (automation.emailRequest) {
      const emailMessage = "Want exclusive content? Reply with your email!";
      await sendDirectMessage(pageToken, commenterId, emailMessage);
      console.log(`Sent email request DM to ${commenterId}`);
    }
  } catch (error) {
    console.error("Error processing automation:", error);
  }
};

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
      {
        params: { access_token: pageToken },
      }
    );
    console.log(`DM sent successfully to ${userId}:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error sending DM:", error.response?.data || error.message);
    throw error;
  }
};

const replyToComment = async (
  pageToken: string,
  commentId: string,
  message: string
) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${FB_API_VERSION}/${commentId}/replies`,
      { message },
      {
        params: { access_token: pageToken },
      }
    );
    console.log(`Comment reply sent for ${commentId}:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error replying to comment:",
      error.response?.data || error.message
    );
    throw error;
  }
};
