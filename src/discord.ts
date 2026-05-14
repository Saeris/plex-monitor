import { PlexWebhookPayload } from "./schema";
import { fetchMovieDetails, fetchTVSeriesDetails } from "./tmdb";
import type { DiscordWebhookPayload } from "./types";

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

const getTmdbId = ({ Guid }: PlexWebhookPayload["Metadata"]) => {
  const tmdbGuid = Guid?.find((g) => g.id?.startsWith("tmdb://"));
  return tmdbGuid?.id?.replace("tmdb://", "");
};

/**
 * Create message for a new series
 */
const createShowMessage = async ({ Server, Metadata }: PlexWebhookPayload): Promise<DiscordWebhookPayload> => {
  const statsLine = [
    Metadata.childCount ? `Seasons: ${Metadata.childCount}` : "",
    Metadata.leafCount ? `Episodes: ${Metadata.leafCount}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const data = await fetchTVSeriesDetails(getTmdbId(Metadata));

  return {
    flags: 32768,
    components: [
      {
        type: 9, // ComponentType.SECTION
        components: [
          {
            type: 10, // ComponentType.TEXT_DISPLAY
            content: `### TV Series updated in ${Metadata.librarySectionTitle}\n${Metadata.year ? `**${Metadata.title} (${Metadata.year})**` : `**${Metadata.title}**`}\n${statsLine ? `${statsLine}\n` : ``}${Metadata.summary ? `> ${Metadata.summary}` : ``}\n-# Added to ${Server.title} on *<t:${Math.floor(Metadata.addedAt)}:D>*`,
          },
        ],
        accessory: {
          type: 11, // ComponentType.THUMBNAIL
          media: {
            url: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
          },
        },
      },
    ],
  };
};

const createMovieMessage = async ({ Server, Metadata }: PlexWebhookPayload): Promise<DiscordWebhookPayload> => {
  const data = await fetchMovieDetails(getTmdbId(Metadata));

  return {
    flags: 32768,
    components: [
      {
        type: 9, // ComponentType.SECTION
        components: [
          {
            type: 10, // ComponentType.TEXT_DISPLAY
            content: `### New Movie added in ${Metadata.librarySectionTitle}\n**${Metadata.title}${Metadata.year ? ` (${Metadata.year})**` : ``}\n${Metadata.duration ? `Runtime: ${formatRuntime(Math.round(Metadata.duration / 60000))}\n` : ``}${Metadata.director ? `Directed by: ${Metadata.director}\n` : ``}${Metadata.Genre && Metadata.Genre.length > 0 ? `Genres: ${Metadata.Genre?.map((g) => g.tag)}\n` : ``}${Metadata.summary ? `> ${Metadata.summary}` : ``}\n-# Added to ${Server.title} on *<t:${Math.floor(Metadata.addedAt)}:D>*`,
          },
        ],
        accessory: {
          type: 11, // ComponentType.THUMBNAIL
          media: {
            url: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
          },
        },
      },
    ],
  };
};

/**
 * Create Discord webhook payload with formatted markdown message
 * Based on the media type (show, season, or movie)
 */
export function createDiscordMessage(payload: PlexWebhookPayload): Promise<DiscordWebhookPayload> {
  if (payload.Metadata.type === "show") {
    return createShowMessage(payload);
  }

  if (payload.Metadata.type === "movie") {
    return createMovieMessage(payload);
  }

  throw new Error(`Unsupported media type: ${payload.Metadata.type}`);
}

/**
 * Send a message to Discord via webhook
 */
export async function sendDiscordWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
  const response = await fetch(`${webhookUrl}?with_components=true`, {
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
