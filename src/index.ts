import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import * as v from "valibot";
import { enqueue } from "./queue.js";
import { PlexWebhookPayloadSchema } from "./schema.js";

const app = new Elysia({ name: "plex-discord-webhook", adapter: node() })
  .onError(({ code, error, set }) => {
    if (error instanceof Error) {
      console.error("Error:", { code, error: error.message });
    }

    // Handle Valibot validation errors
    if (error instanceof v.ValiError) {
      set.status = 400;
      return {
        error: "Invalid webhook payload",
        message: "Plex webhook data validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path?.map(([key]: [key: string]) => key).join("."),
          message: issue.message,
          expected: issue.expected,
          received: issue.received
        }))
      };
    }

    // Handle Elysia validation errors
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation Error",
        message: error.message
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not Found",
        message: "Endpoint not found"
      };
    }

    // Handle all other errors
    set.status = 500;
    return {
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error"
    };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!body.payload) {
        set.status = 400;
        return {
          error: "Bad Request",
          message: "No payload found in form data"
        };
      }

      const payload = body.payload;

      // Filter: only process library.new events
      if (payload.event !== "library.new") {
        return {
          success: false,
          message: "Event type not supported",
          event: payload.event
        };
      }

      // Filter: only process shows, seasons, and movies
      const supportedTypes = ["show", "season", "movie"] as const;
      if (!supportedTypes.includes(payload.Metadata.type as any)) {
        return {
          success: false,
          message: "Media type not supported",
          type: payload.Metadata.type
        };
      }

      console.log(
        `Queued: ${payload.Metadata.type === "movie" ? "🎬" : "📺"} ${payload.Metadata.title}`
      );

      enqueue(payload);
      set.status = 202;

      return {
        success: true,
        message: "Queued for Discord notification"
      };
    },
    {
      body: v.looseObject({
        payload: PlexWebhookPayloadSchema
      })
    }
  );

export { app };
export type App = typeof app;
