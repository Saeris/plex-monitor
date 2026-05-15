import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vite-plus/test";

const TEST_CONFIG_PATH = path.join(
  os.tmpdir(),
  ".plex-monitor.config-config-test.json"
);
process.env.PLEX_MONITOR_CONFIG_PATH = TEST_CONFIG_PATH;

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    try {
      fs.unlinkSync(TEST_CONFIG_PATH);
    } catch {
      /* no-op */
    }
  });

  afterEach(() => {
    try {
      fs.unlinkSync(TEST_CONFIG_PATH);
    } catch {
      /* no-op */
    }
  });

  describe("configExists", () => {
    it("returns false when no config file exists", async () => {
      const { configExists } = await import("../config.js");
      expect(configExists()).toBe(false);
    });

    it("returns true after a config file is written", async () => {
      const { configExists, writeConfig } = await import("../config.js");
      writeConfig({
        port: 3000,
        discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
        tmdbApiKey: "key"
      });
      expect(configExists()).toBe(true);
    });
  });

  describe("writeConfig", () => {
    it("writes partial values and merges with existing", async () => {
      const { writeConfig } = await import("../config.js");
      writeConfig({ port: 3000 });
      writeConfig({ tmdbApiKey: "abc" });
      const raw = JSON.parse(
        fs.readFileSync(TEST_CONFIG_PATH, "utf8")
      ) as Record<string, unknown>;
      expect(raw.port).toBe(3000);
      expect(raw.tmdbApiKey).toBe("abc");
    });

    it("overwrites an existing field", async () => {
      const { writeConfig } = await import("../config.js");
      writeConfig({ port: 3000 });
      writeConfig({ port: 4000 });
      const raw = JSON.parse(
        fs.readFileSync(TEST_CONFIG_PATH, "utf8")
      ) as Record<string, unknown>;
      expect(raw.port).toBe(4000);
    });
  });

  describe("loadConfig", () => {
    it("throws when config file does not exist", async () => {
      const { loadConfig } = await import("../config.js");
      expect(() => loadConfig()).toThrow(/plex-monitor init/);
    });

    it("throws when required fields are missing", async () => {
      const { loadConfig } = await import("../config.js");
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ port: 3000 }));
      expect(() => loadConfig()).toThrow(/Missing\/invalid fields/);
    });

    it("throws when port is out of range", async () => {
      const { loadConfig } = await import("../config.js");
      fs.writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          port: 99999,
          discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
          tmdbApiKey: "key"
        })
      );
      expect(() => loadConfig()).toThrow(/Missing\/invalid fields/);
    });

    it("throws when discordWebhookUrl is not a valid URL", async () => {
      const { loadConfig } = await import("../config.js");
      fs.writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          port: 3000,
          discordWebhookUrl: "not-a-url",
          tmdbApiKey: "key"
        })
      );
      expect(() => loadConfig()).toThrow(/Missing\/invalid fields/);
    });

    it("returns the config when all fields are valid", async () => {
      const { loadConfig } = await import("../config.js");
      fs.writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          port: 3000,
          discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
          tmdbApiKey: "abc123"
        })
      );
      const config = loadConfig();
      expect(config.port).toBe(3000);
      expect(config.discordWebhookUrl).toBe(
        "https://discord.com/api/webhooks/1/token"
      );
      expect(config.tmdbApiKey).toBe("abc123");
    });
  });

  describe("getConfig singleton", () => {
    it("returns the same object on repeated calls", async () => {
      const { getConfig } = await import("../config.js");
      fs.writeFileSync(
        TEST_CONFIG_PATH,
        JSON.stringify({
          port: 3000,
          discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
          tmdbApiKey: "abc"
        })
      );
      expect(getConfig()).toBe(getConfig());
    });
  });
});
