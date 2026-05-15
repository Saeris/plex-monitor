import type { PlexWebhookPayload } from "./schema.js";
import { fetchMovieDetails, fetchTVSeriesDetails } from "./tmdb.js";
import type { DiscordWebhookPayload } from "./types.js";

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  return mins > 0 ? `${hours}hr ${mins}min` : `${hours}hr`;
}

const getTmdbId = ({ Guid }: PlexWebhookPayload["Metadata"]) =>
  Guid?.find((g) => g.id?.startsWith("tmdb://"))?.id?.replace("tmdb://", "");

function youtubeTrailerUrl(
  videos:
    | {
        results: {
          site: string;
          type: string;
          official: boolean;
          key: string;
        }[];
      }
    | undefined
): string | null {
  if (!videos) return null;
  const trailer =
    videos.results.find(
      (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
    ) ??
    videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

const createShowMessage = async ({
  Server,
  Metadata
}: PlexWebhookPayload): Promise<DiscordWebhookPayload> => {
  const data = await fetchTVSeriesDetails(getTmdbId(Metadata));

  const title = data.name;
  const year = data.first_air_date ? data.first_air_date.slice(0, 4) : null;
  const genres = data.genres.map((g) => g.name).join(", ");
  const creators = data.created_by.map((c) => c.name).join(", ");
  const overview = data.overview || null;
  const seasons = data.number_of_seasons;
  const episodes = data.number_of_episodes;

  const lines: string[] = [
    `### New TV Series added in ${Metadata.librarySectionTitle}`,
    year ? `**${title} (${year})**` : `**${title}**`,
    `Seasons: ${seasons} | Episodes: ${episodes}`,
    genres ? `Genres: ${genres}` : "",
    creators ? `Created by: ${creators}` : "",
    overview ? `> ${overview}` : "",
    `-# Added to ${Server.title} on *<t:${Math.floor(Metadata.addedAt)}:D>*`
  ].filter(Boolean);

  return {
    flags: 32768,
    components: [
      {
        type: 9,
        components: [{ type: 10, content: lines.join("\n") }],
        accessory: {
          type: 11,
          media: { url: `https://image.tmdb.org/t/p/w500${data.poster_path}` }
        }
      }
    ]
  };
};

const createMovieMessage = async ({
  Server,
  Metadata
}: PlexWebhookPayload): Promise<DiscordWebhookPayload> => {
  const data = await fetchMovieDetails(getTmdbId(Metadata));

  const title = data.title;
  const year = data.release_date ? data.release_date.slice(0, 4) : null;
  const genres = data.genres.map((g) => g.name).join(", ");
  const directors = data.credits?.crew
    .filter((c) => c.job === "Director")
    .map((c) => c.name)
    .join(", ");
  const runtime = data.runtime ? formatRuntime(data.runtime) : null;
  const overview = data.overview || null;
  const trailer = youtubeTrailerUrl(data.videos);

  const lines: string[] = [
    `### New Movie added in ${Metadata.librarySectionTitle}`,
    year ? `**${title} (${year})**` : `**${title}**`,
    runtime ? `Runtime: ${runtime}` : "",
    genres ? `Genres: ${genres}` : "",
    directors ? `Directed by: ${directors}` : "",
    overview ? `> ${overview}` : "",
    trailer ? `[▶ Watch Trailer](${trailer})` : "",
    `-# Added to ${Server.title} on *<t:${Math.floor(Metadata.addedAt)}:D>*`
  ].filter(Boolean);

  return {
    flags: 32768,
    components: [
      {
        type: 9,
        components: [{ type: 10, content: lines.join("\n") }],
        accessory: {
          type: 11,
          media: { url: `https://image.tmdb.org/t/p/w500${data.poster_path}` }
        }
      }
    ]
  };
};

export async function createDiscordMessage(
  payload: PlexWebhookPayload
): Promise<DiscordWebhookPayload> {
  if (payload.Metadata.type === "show") return createShowMessage(payload);
  if (payload.Metadata.type === "movie") return createMovieMessage(payload);
  throw new Error(`Unsupported media type: ${payload.Metadata.type}`);
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<void> {
  const response = await fetch(`${webhookUrl}?with_components=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.status === 429) {
    const retryAfter =
      Number(
        response.headers.get("retry-after") ??
          response.headers.get("x-ratelimit-reset-after") ??
          "5"
      ) * 1000;
    await new Promise((resolve) => setTimeout(resolve, retryAfter));
    const retry = await fetch(`${webhookUrl}?with_components=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!retry.ok) {
      const errorText = await retry.text();
      throw new Error(
        `Discord webhook failed after retry: ${retry.status} ${retry.statusText} - ${errorText}`
      );
    }
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Discord webhook failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }
}
