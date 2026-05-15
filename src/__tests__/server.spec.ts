import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vite-plus/test";

const TEST_CONFIG_PATH = path.join(
  os.tmpdir(),
  ".plex-monitor.config-server-test.json"
);
process.env.PLEX_MONITOR_CONFIG_PATH = TEST_CONFIG_PATH;
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/123456/test-token";

function makePlexFormRequest(payload: object): Request {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  return new Request("http://localhost/", { method: "POST", body: form });
}

const moviePayload = {
  event: "library.new",
  user: true,
  owner: true,
  Account: { id: 1, thumb: "", title: "testuser" },
  Server: { title: "My Plex Server", uuid: "abc-123" },
  Metadata: {
    librarySectionType: "movie",
    ratingKey: "100",
    key: "/library/metadata/100",
    guid: "plex://movie/abc",
    type: "movie",
    title: "Star Wars",
    year: 1977,
    librarySectionTitle: "Movies",
    librarySectionID: 1,
    librarySectionKey: "/library/sections/1",
    addedAt: 1700000000,
    updatedAt: 1700000000,
    Guid: [{ id: "tmdb://11" }]
  }
};

const showPayload = {
  ...moviePayload,
  Metadata: {
    ...moviePayload.Metadata,
    librarySectionType: "show",
    type: "show",
    title: "Lost",
    librarySectionTitle: "TV Shows",
    childCount: 6,
    leafCount: 121,
    Guid: [{ id: "tmdb://4607" }]
  }
};

describe("webhook route", () => {
  beforeAll(() => {
    fs.writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        port: 3000,
        discordWebhookUrl: DISCORD_WEBHOOK_URL,
        tmdbApiKey: "test-key"
      })
    );
  });

  let app: { handle: (req: Request) => Promise<Response> };
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../index.js");
    app = mod.app;
  });

  describe("event filtering", () => {
    it("returns 200 with success:false for non-library.new events", async () => {
      const payload = { ...moviePayload, event: "media.play" };
      const res = await app.handle(makePlexFormRequest(payload));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; event: string };
      expect(body.success).toBe(false);
      expect(body.event).toBe("media.play");
    });

    it("returns 200 with success:false for unsupported media type (episode)", async () => {
      const payload = {
        ...moviePayload,
        Metadata: { ...moviePayload.Metadata, type: "episode" }
      };
      const res = await app.handle(makePlexFormRequest(payload));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; type: string };
      expect(body.success).toBe(false);
      expect(body.type).toBe("episode");
    });
  });

  describe("movie webhook", () => {
    it("returns 202 with success:true and queues for Discord", async () => {
      const res = await app.handle(makePlexFormRequest(moviePayload));
      expect(res.status).toBe(202);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("show webhook", () => {
    it("returns 202 with success:true and queues for Discord", async () => {
      const res = await app.handle(makePlexFormRequest(showPayload));
      expect(res.status).toBe(202);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("validation", () => {
    it("returns 400 when payload field is missing", async () => {
      const form = new FormData();
      const res = await app.handle(
        new Request("http://localhost/", { method: "POST", body: form })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when payload JSON is malformed", async () => {
      const form = new FormData();
      form.append("payload", "{ not valid json");
      const res = await app.handle(
        new Request("http://localhost/", { method: "POST", body: form })
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown routes", async () => {
      const res = await app.handle(
        new Request("http://localhost/unknown", { method: "GET" })
      );
      expect(res.status).toBe(404);
    });
  });
});
