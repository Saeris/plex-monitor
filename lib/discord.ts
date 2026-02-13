import type { ParsedWebhookData, DiscordWebhookPayload } from "./types";

/**
 * Format runtime in minutes to "Xhr YYmin" format
 */
function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}min`;
  }

  return mins > 0 ? `${hours}hr ${mins}min` : `${hours}hr`;
}

/**
 * Create message for a new series
 */
function createShowMessage(
  metadata: ParsedWebhookData["metadata"],
  serverName: string,
  timestamp: number,
): DiscordWebhookPayload {
  const titleWithYear = metadata.year ? `**${metadata.title} (${metadata.year})**` : `**${metadata.title}**`;

  const seasonsInfo = metadata.seasonCount ? `Seasons: ${metadata.seasonCount}` : "";

  const episodesInfo = metadata.episodeCount ? `Episodes: ${metadata.episodeCount}` : "";

  const statsLine = [seasonsInfo, episodesInfo].filter(Boolean).join(" | ");

  let content = `## New Series added in ${metadata.libraryName}\n\n`;
  content += `${titleWithYear}\n`;

  if (statsLine) {
    content += `${statsLine}\n`;
  }

  if (metadata.summary) {
    content += `\n> ${metadata.summary}\n`;
  }

  content += `\n-# Added to ${serverName} on *<t:${timestamp}:D>*`;

  const payload: DiscordWebhookPayload = {
    content,
  };

  // Add thumbnail if available
  if (metadata.thumb) {
    payload.embeds = [
      {
        image: {
          url: metadata.thumb,
        },
      },
    ];
  }

  return payload;
}

/**
 * Create message for a new season
 */
function createSeasonMessage(
  metadata: ParsedWebhookData["metadata"],
  serverName: string,
  timestamp: number,
): DiscordWebhookPayload {
  const seriesTitle = metadata.seriesTitle || metadata.title;
  const seasonNum = metadata.seasonNumber ? String(metadata.seasonNumber).padStart(2, "0") : "??";

  let content = `## New Season added in ${metadata.libraryName}\n\n`;
  content += `**${seriesTitle}** - Season ${seasonNum}\n`;
  content += `\n-# Added to ${serverName} on *<t:${timestamp}:D>*`;

  const payload: DiscordWebhookPayload = {
    content,
  };

  // Add thumbnail if available
  if (metadata.thumb) {
    payload.embeds = [
      {
        image: {
          url: metadata.thumb,
        },
      },
    ];
  }

  return payload;
}

/**
 * Create message for a new movie
 */
function createMovieMessage(
  metadata: ParsedWebhookData["metadata"],
  serverName: string,
  timestamp: number,
): DiscordWebhookPayload {
  const titleWithYear = metadata.year ? `**${metadata.title} (${metadata.year})**` : `**${metadata.title}**`;

  let content = `## New Movie added in ${metadata.libraryName}\n\n`;
  content += `${titleWithYear}\n`;

  // Add runtime
  if (metadata.runtime) {
    content += `Runtime: ${formatRuntime(metadata.runtime)}\n`;
  }

  // Add director
  if (metadata.director) {
    content += `Directed by: ${metadata.director}\n`;
  }

  // Add genres
  if (metadata.genres && metadata.genres.length > 0) {
    content += `Genres: ${metadata.genres.join(", ")}\n`;
  }

  // Add summary
  if (metadata.summary) {
    content += `\n> ${metadata.summary}\n`;
  }

  content += `\n-# Added to ${serverName} on *<t:${timestamp}:D>*`;

  const payload: DiscordWebhookPayload = {
    content,
  };

  // Add thumbnail if available
  if (metadata.thumb) {
    payload.embeds = [
      {
        image: {
          url: metadata.thumb,
        },
      },
    ];
  }

  return payload;
}

/**
 * Create Discord webhook payload with formatted markdown message
 * Based on the media type (show, season, or movie)
 */
export function createDiscordMessage(webhookData: ParsedWebhookData): DiscordWebhookPayload {
  const { metadata, serverName } = webhookData;
  const timestamp = Math.floor(metadata.addedAt);

  if (metadata.type === "show") {
    return createShowMessage(metadata, serverName, timestamp);
  }

  if (metadata.type === "season") {
    return createSeasonMessage(metadata, serverName, timestamp);
  }

  if (metadata.type === "movie") {
    return createMovieMessage(metadata, serverName, timestamp);
  }

  throw new Error(`Unsupported media type: ${metadata.type}`);
}

/**
 * Send a message to Discord via webhook
 */
export async function sendDiscordWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
}
