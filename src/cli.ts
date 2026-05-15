import mri from "mri";
import * as p from "@clack/prompts";
import {
  CONFIG_PATH_DISPLAY,
  DEFAULT_PORT,
  configExists,
  getConfig,
  loadConfig,
  writeConfig
} from "./config.js";

const TMDB_API_DOCS = "https://developer.themoviedb.org/docs/getting-started";
const DISCORD_WEBHOOK_DOCS =
  "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks";

const VERSION = "1.0.0";

// ── Help text ─────────────────────────────────────────────────────────────────

const HELP: Record<string, string> = {
  "": `
plxm v${VERSION}

Usage: plxm [command] [options]

Commands:
  install              Copy binary to PATH, register autostart service, run init if needed
  uninstall            Stop and remove the autostart service
  upgrade              Download the latest release and restart the service
  init                 Interactive configuration wizard
  config [options]     Update configuration values non-interactively

Options:
  -h, --help           Show help
  -v, --version        Show version

Run \`plxm help <command>\` for command-specific help.
`.trim(),

  install: `
Usage: plxm install

Copies the binary to a location on your PATH, registers an autostart service
so the server starts on login, and runs \`plxm init\` if no config exists yet.

  macOS   — LaunchAgent at ~/Library/LaunchAgents/io.github.saeris.plxm.plist
  Linux   — systemd user unit at ~/.config/systemd/user/plxm.service
  Windows — Task Scheduler task named "plxm"
`.trim(),

  uninstall: `
Usage: plxm uninstall

Stops the autostart service and removes its registration. Does not delete
your config file at ${CONFIG_PATH_DISPLAY}.
`.trim(),

  upgrade: `
Usage: plxm upgrade

Downloads the latest release binary for your platform from GitHub, stops the
running service, replaces the binary, and restarts the service.
`.trim(),

  init: `
Usage: plxm init

Interactive wizard that sets or updates:
  - TMDB API key        ${TMDB_API_DOCS}
  - Discord webhook URL ${DISCORD_WEBHOOK_DOCS}
  - Port                Local port for the webhook server (default: ${DEFAULT_PORT})

Config is written to ${CONFIG_PATH_DISPLAY}.
`.trim(),

  config: `
Usage: plxm config [options]

Options:
  --tmdb-api-key <key>           Set the TMDB API key
  --discord-webhook-url <url>    Set the Discord webhook URL
  --port <n>                     Set the port (1–65535)

At least one option is required. Values are merged with the existing config.
`.trim()
};

function showHelp(command = ""): void {
  console.log(HELP[command] ?? `Unknown command: ${command}\n\n${HELP[""]}`);
}

// ── Commands ──────────────────────────────────────────────────────────────────

export async function runInit(): Promise<void> {
  p.intro("plxm setup");

  const existing = configExists()
    ? (() => {
        try {
          return loadConfig();
        } catch {
          return null;
        }
      })()
    : null;

  p.note(`Get your free API key at:\n${TMDB_API_DOCS}`, "TMDB API Key");

  const tmdbApiKey = await p.text({
    message: "TMDB API key",
    placeholder: existing?.tmdbApiKey ? "(keep existing)" : "your-tmdb-api-key",
    defaultValue: existing?.tmdbApiKey ?? "",
    validate: (val) =>
      (val?.length ?? 0) === 0 ? "TMDB API key is required" : undefined
  });

  if (p.isCancel(tmdbApiKey)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  p.note(
    `Create a webhook in your Discord server settings:\n${DISCORD_WEBHOOK_DOCS}\n\nPath: Server Settings → Integrations → Webhooks → New Webhook`,
    "Discord Webhook"
  );

  const discordWebhookUrl = await p.text({
    message: "Discord webhook URL",
    placeholder: existing?.discordWebhookUrl
      ? "(keep existing)"
      : "https://discord.com/api/webhooks/...",
    defaultValue: existing?.discordWebhookUrl ?? "",
    validate: (val) => {
      if (!val || val.length === 0) return "Discord webhook URL is required";
      try {
        new URL(val);
        return undefined;
      } catch {
        return "Must be a valid URL";
      }
    }
  });

  if (p.isCancel(discordWebhookUrl)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const portInput = await p.text({
    message: "Port to listen on",
    placeholder: String(existing?.port ?? DEFAULT_PORT),
    defaultValue: String(existing?.port ?? DEFAULT_PORT),
    validate: (val) => {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 1 || n > 65535)
        return "Must be a port number between 1 and 65535";
      return undefined;
    }
  });

  if (p.isCancel(portInput)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  writeConfig({
    tmdbApiKey: tmdbApiKey as string,
    discordWebhookUrl: discordWebhookUrl as string,
    port: Number(portInput)
  });

  p.outro(
    `Config saved to ${CONFIG_PATH_DISPLAY}\nRun plxm to start the server.`
  );
}

async function runConfigCommand(argv: string[]): Promise<void> {
  const args = mri(argv, {
    string: ["port", "discord-webhook-url", "tmdb-api-key"],
    boolean: ["help"],
    alias: { h: "help" }
  });

  if (args.help) {
    showHelp("config");
    return;
  }

  const update: Parameters<typeof writeConfig>[0] = {};
  let hasUpdate = false;

  if (args["port"] !== undefined) {
    const n = Number(args["port"]);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      console.error(`Invalid port: ${args["port"]}`);
      process.exit(1);
    }
    update.port = n;
    hasUpdate = true;
  }

  if (args["discord-webhook-url"] !== undefined) {
    try {
      new URL(args["discord-webhook-url"]);
    } catch {
      console.error(
        `Invalid Discord webhook URL: ${args["discord-webhook-url"]}`
      );
      process.exit(1);
    }
    update.discordWebhookUrl = args["discord-webhook-url"];
    hasUpdate = true;
  }

  if (args["tmdb-api-key"] !== undefined) {
    if ((args["tmdb-api-key"] as string).length === 0) {
      console.error("TMDB API key cannot be empty");
      process.exit(1);
    }
    update.tmdbApiKey = args["tmdb-api-key"];
    hasUpdate = true;
  }

  if (!hasUpdate) {
    showHelp("config");
    process.exit(1);
  }

  writeConfig(update);
  console.log(`Config updated at ${CONFIG_PATH_DISPLAY}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = mri(process.argv.slice(2), {
    boolean: ["help", "version"],
    alias: { h: "help", v: "version" }
  });

  if (args.version) {
    console.log(`plxm v${VERSION}`);
    return;
  }

  const command = args._[0];

  // `plxm help [command]` and `plxm [command] --help` both work
  if (command === "help" || args.help) {
    showHelp(command === "help" ? (args._[1] ?? "") : command);
    return;
  }

  if (command === "init") {
    await runInit();
    return;
  }

  if (command === "config") {
    await runConfigCommand(process.argv.slice(3));
    return;
  }

  if (command === "install") {
    const { runInstall } = await import("./install.js");
    await runInstall(async () => {
      if (!configExists()) {
        console.log("");
        await runInit();
      }
    });
    return;
  }

  if (command === "uninstall") {
    const { runUninstall } = await import("./install.js");
    await runUninstall();
    return;
  }

  if (command === "upgrade") {
    const { runUpgrade } = await import("./install.js");
    await runUpgrade();
    return;
  }

  if (command !== undefined) {
    console.error(`Unknown command: ${command}\n`);
    showHelp();
    process.exit(1);
  }

  // No subcommand — start the server. Run init if config is missing or invalid.
  let configValid = false;
  if (configExists()) {
    try {
      getConfig();
      configValid = true;
    } catch {
      configValid = false;
    }
  }

  if (!configValid) {
    console.log("No valid configuration found. Let's set things up first.\n");
    await runInit();
    console.log("");
  }

  // Dynamically import to ensure config is loaded before the app module initializes.
  const { startServer } = await import("./server.js");
  startServer();
}

await main();
