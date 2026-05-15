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
import {
  TMDB_MOVIE_POSTER,
  TMDB_MOVIE_TRAILER_KEY,
  TMDB_SHOW_POSTER
} from "../../vitest.setup.js";
import type { PlexWebhookPayload } from "../schema.js";
import type { SectionComponent, TextDisplayComponent } from "../types.js";

const TEST_CONFIG_PATH = path.join(
  os.tmpdir(),
  ".plex-monitor.config-discord-test.json"
);
process.env.PLEX_MONITOR_CONFIG_PATH = TEST_CONFIG_PATH;
const IS_COMPONENTS_V2 = 32768; // 1 << 15

const basePayload: PlexWebhookPayload = {
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
    librarySectionTitle: "Movies",
    librarySectionID: 1,
    librarySectionKey: "/library/sections/1",
    addedAt: 1700000000,
    updatedAt: 1700000000,
    year: 1977,
    Guid: [{ id: "tmdb://11" }]
  }
};

describe("createDiscordMessage", () => {
  beforeAll(() => {
    fs.writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        port: 3000,
        discordWebhookUrl: "https://discord.com/api/webhooks/123/token",
        tmdbApiKey: "test-key"
      })
    );
  });

  let createDiscordMessage: (
    payload: PlexWebhookPayload
  ) => Promise<import("../types.js").DiscordWebhookPayload>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../discord.js");
    createDiscordMessage = mod.createDiscordMessage;
  });

  describe("movie", () => {
    it("sets IS_COMPONENTS_V2 flag", async () => {
      const result = await createDiscordMessage(basePayload);
      expect(result.flags).toBe(IS_COMPONENTS_V2);
    });

    it("produces a single Section component at the top level", async () => {
      const result = await createDiscordMessage(basePayload);
      expect(result.components).toHaveLength(1);
      expect(result.components![0].type).toBe(9);
    });

    it("section contains a single TextDisplay component", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      expect(section.components).toHaveLength(1);
      expect(section.components[0].type).toBe(10);
    });

    it("thumbnail accessory uses TMDB poster URL", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      expect(section.accessory.type).toBe(11);
      expect(section.accessory.media.url).toBe(
        `https://image.tmdb.org/t/p/w500${TMDB_MOVIE_POSTER}`
      );
    });

    it("text content includes title and year sourced from TMDB", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain("Star Wars");
      expect(text.content).toContain("1977");
    });

    it("text content includes the library section name", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain("Movies");
    });

    it("text content includes the server name", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain("My Plex Server");
    });

    it("text content includes runtime from TMDB", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      // TMDB mock returns runtime: 121 minutes
      expect(text.content).toContain("2hr 1min");
    });

    it("text content includes genres from TMDB", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      // TMDB mock returns genres: [{ name: "Action" }]
      expect(text.content).toContain("Action");
    });

    it("text content includes director from TMDB credits", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      // TMDB mock returns crew: [{ name: "George Lucas", job: "Director" }]
      expect(text.content).toContain("George Lucas");
    });

    it("text content includes overview as blockquote from TMDB", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain(
        "> A long time ago in a galaxy far, far away..."
      );
    });

    it("text content includes YouTube trailer link", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain(
        `https://www.youtube.com/watch?v=${TMDB_MOVIE_TRAILER_KEY}`
      );
    });

    it("includes the addedAt timestamp as a Discord timestamp tag", async () => {
      const result = await createDiscordMessage(basePayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain("<t:1700000000:D>");
    });
  });

  describe("show", () => {
    const showPayload: PlexWebhookPayload = {
      ...basePayload,
      Metadata: {
        ...basePayload.Metadata,
        librarySectionType: "show",
        type: "show",
        title: "Lost",
        librarySectionTitle: "TV Shows",
        year: 2004,
        childCount: 6,
        leafCount: 121,
        Guid: [{ id: "tmdb://4607" }]
      }
    };

    it("sets IS_COMPONENTS_V2 flag", async () => {
      const result = await createDiscordMessage(showPayload);
      expect(result.flags).toBe(IS_COMPONENTS_V2);
    });

    it("thumbnail accessory uses TMDB show poster URL", async () => {
      const result = await createDiscordMessage(showPayload);
      const section = result.components![0] as SectionComponent;
      expect(section.accessory.media.url).toBe(
        `https://image.tmdb.org/t/p/w500${TMDB_SHOW_POSTER}`
      );
    });

    it("text content includes title, season count, and episode count from TMDB", async () => {
      const result = await createDiscordMessage(showPayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain("Lost");
      // TMDB mock returns number_of_seasons: 6, number_of_episodes: 121
      expect(text.content).toContain("Seasons: 6");
      expect(text.content).toContain("Episodes: 121");
    });

    it("text content includes overview as blockquote from TMDB", async () => {
      const result = await createDiscordMessage(showPayload);
      const section = result.components![0] as SectionComponent;
      const text = section.components[0] as TextDisplayComponent;
      expect(text.content).toContain(
        "> Survivors of a plane crash are stranded on a mysterious island."
      );
    });
  });

  describe("unsupported type", () => {
    it("throws for season type", async () => {
      const payload: PlexWebhookPayload = {
        ...basePayload,
        Metadata: { ...basePayload.Metadata, type: "season" }
      };
      await expect(createDiscordMessage(payload)).rejects.toThrow(
        "Unsupported media type: season"
      );
    });

    it("throws for episode type", async () => {
      const payload: PlexWebhookPayload = {
        ...basePayload,
        Metadata: { ...basePayload.Metadata, type: "episode" }
      };
      await expect(createDiscordMessage(payload)).rejects.toThrow(
        "Unsupported media type: episode"
      );
    });
  });
});
