import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseMultipartForm, parsePlexWebhook } from "../lib/plex";
import { createDiscordMessage, sendDiscordWebhook } from "../lib/discord";

/**
 * Vercel serverless function that receives Plex webhooks and forwards
 * notifications to Discord for new content additions
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse the multipart form data from Plex
    const formData = await parseMultipartForm(req);

    // Extract and parse the Plex webhook payload
    const webhookData = parsePlexWebhook(formData);

    // Filter: only process library.new events (new content added)
    if (webhookData.event !== "library.new") {
      return res.status(200).json({
        message: "Event type not supported",
        event: webhookData.event,
      });
    }

    // Filter: only process shows, seasons, and movies
    const supportedTypes = ["show", "season", "movie"];
    if (!supportedTypes.includes(webhookData.metadata.type)) {
      return res.status(200).json({
        message: "Media type not supported",
        type: webhookData.metadata.type,
      });
    }

    // Get Discord webhook URL from environment variable
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!discordWebhookUrl) {
      throw new Error("DISCORD_WEBHOOK_URL environment variable not set");
    }

    // Create the Discord message payload
    const discordPayload = createDiscordMessage(webhookData);

    // Send to Discord
    await sendDiscordWebhook(discordWebhookUrl, discordPayload);

    return res.status(200).json({
      success: true,
      message: "Notification sent to Discord",
    });
  } catch (error) {
    console.error("Error processing Plex webhook:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
