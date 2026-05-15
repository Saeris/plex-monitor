import { getConfig } from "./config.js";
import { createDiscordMessage, sendDiscordWebhook } from "./discord.js";
import type { PlexWebhookPayload } from "./schema.js";

// Delay between Discord sends — safely under the 30 req/30s rate limit.
const SEND_INTERVAL_MS = 1100;

// Inactivity window before the queue flushes. Resets on each new enqueue.
const DEBOUNCE_MS = 10_000;

const pending: PlexWebhookPayload[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (pending.length === 0) return;

  const items = pending.splice(0, pending.length);
  const { discordWebhookUrl } = getConfig();

  for (let i = 0; i < items.length; i++) {
    if (i > 0)
      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    try {
      const payload = await createDiscordMessage(items[i]);
      await sendDiscordWebhook(discordWebhookUrl, payload);
    } catch (err) {
      console.error(
        `Failed to send Discord notification for "${items[i].Metadata.title}":`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

export function enqueue(payload: PlexWebhookPayload): void {
  pending.push(payload);

  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void (async () => {
      try {
        await flush();
      } catch (err: unknown) {
        console.error(
          "Queue flush error:",
          err instanceof Error ? err.message : err
        );
      }
    })();
  }, DEBOUNCE_MS);
}
