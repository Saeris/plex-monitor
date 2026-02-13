import type { VercelRequest } from "@vercel/node";
import type { PlexWebhookPayload, ParsedWebhookData } from "./types";
import { Readable } from "stream";

/**
 * Parse multipart form data from Plex webhook
 * Plex sends webhook data as multipart/form-data with a 'payload' field
 */
export async function parseMultipartForm(req: VercelRequest): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = req as unknown as Readable;

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const body = buffer.toString("utf-8");

        // Extract the boundary from Content-Type header
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(.+)/);

        if (!boundaryMatch) {
          reject(new Error("No boundary found in Content-Type"));
          return;
        }

        const boundary = boundaryMatch[1];
        const parts = body.split(`--${boundary}`);
        const formData: Record<string, string> = {};

        for (const part of parts) {
          // Extract field name and value
          const nameMatch = part.match(/name="([^"]+)"/);
          if (nameMatch) {
            const fieldName = nameMatch[1];
            // Extract the value after the headers (after double CRLF)
            const valueMatch = part.split("\r\n\r\n")[1];
            if (valueMatch) {
              formData[fieldName] = valueMatch.split("\r\n")[0];
            }
          }
        }

        resolve(formData);
      } catch (error) {
        reject(error);
      }
    });

    stream.on("error", reject);
  });
}

/**
 * Parse the Plex webhook JSON payload into a structured format
 */
export function parsePlexWebhook(formData: Record<string, string>): ParsedWebhookData {
  const payloadJson = formData.payload;

  if (!payloadJson) {
    throw new Error("No payload found in form data");
  }

  const payload: PlexWebhookPayload = JSON.parse(payloadJson);
  const metadata = payload.Metadata;

  // Determine media type and extract relevant fields
  const type = metadata.type;

  if (type === "show") {
    return {
      event: payload.event,
      serverName: payload.Server.title,
      metadata: {
        type: "show",
        title: metadata.title,
        summary: metadata.summary,
        libraryName: metadata.librarySectionTitle,
        thumb: metadata.thumb,
        addedAt: metadata.addedAt,
        seasonCount: metadata.childCount,
        episodeCount: metadata.leafCount,
        year: metadata.year,
      },
    };
  }

  if (type === "season") {
    return {
      event: payload.event,
      serverName: payload.Server.title,
      metadata: {
        type: "season",
        title: metadata.title,
        seriesTitle: metadata.parentTitle || metadata.grandparentTitle,
        seasonNumber: metadata.index,
        summary: metadata.summary,
        libraryName: metadata.librarySectionTitle,
        thumb: metadata.thumb || metadata.parentThumb || metadata.grandparentThumb,
        addedAt: metadata.addedAt,
        episodeCount: metadata.leafCount,
      },
    };
  }

  if (type === "movie") {
    return {
      event: payload.event,
      serverName: payload.Server.title,
      metadata: {
        type: "movie",
        title: metadata.title,
        summary: metadata.summary,
        libraryName: metadata.librarySectionTitle,
        thumb: metadata.thumb,
        addedAt: metadata.addedAt,
        year: metadata.year,
        runtime: metadata.duration ? Math.round(metadata.duration / 60000) : undefined,
        director: metadata.Director?.[0]?.tag,
        genres: metadata.Genre?.map((g) => g.tag),
      },
    };
  }

  throw new Error(`Unsupported media type: ${type}`);
}
