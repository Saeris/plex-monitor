import * as v from "valibot";
import { enqueue } from "./queue.js";
import { PlexWebhookPayloadSchema } from "./schema.js";

// Plex posts every event (play, pause, rate, …) to the webhook. Only the event
// name is checked up front so unrelated payloads (e.g. music tracks, which
// the full schema rejects) are ignored instead of reported as invalid.
const PlexEventSchema = v.looseObject({ event: v.string() });

const SUPPORTED_TYPES = new Set(["show", "season", "movie"]);

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status });

/** Handles a Plex webhook request (multipart/form-data with a JSON `payload` field). */
export async function handleWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST" || new URL(request.url).pathname !== "/") {
    return json({ error: "Not Found", message: "Endpoint not found" }, 404);
  }

  let raw: unknown;
  try {
    const field = (await request.formData()).get("payload");
    if (typeof field !== "string") {
      return json(
        { error: "Bad Request", message: "No payload found in form data" },
        400
      );
    }
    raw = JSON.parse(field);
  } catch (err) {
    return json(
      {
        error: "Bad Request",
        message: err instanceof Error ? err.message : "Unreadable form data"
      },
      400
    );
  }

  const event = v.safeParse(PlexEventSchema, raw);
  if (!event.success) {
    return json(
      { error: "Bad Request", message: "Payload is missing an event name" },
      400
    );
  }

  // Filter: only process library.new events
  if (event.output.event !== "library.new") {
    return json({
      success: false,
      message: "Event type not supported",
      event: event.output.event
    });
  }

  const result = v.safeParse(PlexWebhookPayloadSchema, raw);
  if (!result.success) {
    const issues = result.issues.map((issue) => ({
      path: issue.path?.map(({ key }) => String(key)).join("."),
      message: issue.message,
      expected: issue.expected,
      received: issue.received
    }));
    console.error(
      `Invalid library.new payload (fields: ${issues.map((i) => i.path).join(", ")})`
    );
    return json(
      {
        error: "Invalid webhook payload",
        message: "Plex webhook data validation failed",
        issues
      },
      400
    );
  }

  const payload = result.output;

  // Filter: only process shows, seasons, and movies
  if (!SUPPORTED_TYPES.has(payload.Metadata.type)) {
    return json({
      success: false,
      message: "Media type not supported",
      type: payload.Metadata.type
    });
  }

  console.log(
    `Queued: ${payload.Metadata.type === "movie" ? "🎬" : "📺"} ${payload.Metadata.title}`
  );

  enqueue(payload);

  return json(
    { success: true, message: "Queued for Discord notification" },
    202
  );
}
