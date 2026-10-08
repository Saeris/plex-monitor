import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSea } from "node:sea";
import mri from "mri";
import * as p from "@clack/prompts";
import pkg from "../package.json" with { type: "json" };
import {
  CONFIG_PATH_DISPLAY,
  DEFAULT_PORT,
  configExists,
  getConfig,
  loadConfig,
  writeConfig
} from "./config.js";
import { LOG_PATH, logToFile } from "./log.js";
import { startTray, WINDOWLESS_EXE } from "./tray.js";

const TMDB_API_DOCS = "https://developer.themoviedb.org/docs/getting-started";
const DISCORD_WEBHOOK_DOCS =
  "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks";

export const VERSION = pkg.version;

// The windowless twin (plxmw.exe) has no console: it logs to a file and shows
// a tray icon instead.
const isWindowless =
  process.platform === "win32" &&
  path.basename(process.execPath).toLowerCase() === WINDOWLESS_EXE;

// ── Help text ─────────────────────────────────────────────────────────────────

export const HELP: Record<string, string> = {
  "": `
plxm v${VERSION}

Usage: plxm [command] [options]

Commands:
  install              Copy binary to PATH, register autostart service, run init if needed
  uninstall            Stop and remove the autostart service
  init                 Interactive configuration wizard
  config [options]     Update configuration values non-interactively
  stop                 Stop a running background server

Options:
  -h, --help           Show help
  -v, --version        Show version
  -d, --detach         Start the server in the background (no subcommand only)

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
`.trim(),

  stop: `
Usage: plxm stop

Stops the background server, whether started at login or with
\`plxm --detach\`. Has no effect if no background server is running.
`.trim()
};

export function showHelp(command = ""): void {
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
    message: `Port to listen on (default: ${existing?.port ?? DEFAULT_PORT})`,
    placeholder: String(existing?.port ?? DEFAULT_PORT),
    defaultValue: String(existing?.port ?? DEFAULT_PORT),
    validate: (val) => {
      if (!val || val.length === 0) return undefined;
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

async function runStop(): Promise<void> {
  const { stopServer } = await import("./server.js");
  const pid = await stopServer();
  console.log(
    pid === null
      ? "No background server is running."
      : `Stopped server (pid ${pid}).`
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  if (isWindowless) {
    logToFile();
    // The setup wizard below can't be answered without a console and would
    // hang invisibly, so fail with a logged error instead.
    try {
      getConfig();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  const args = mri(process.argv.slice(2), {
    boolean: ["help", "version", "detach"],
    alias: { h: "help", v: "version", d: "detach" }
  });

  if (args.version) {
    console.log(`plxm v${VERSION}`);
    return;
  }

  const command = args._[0];

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

  if (command === "stop") {
    await runStop();
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

  // Check if a server is already running.
  const { readPid, isRunning } = await import("./server.js");
  const existingPid = readPid();
  if (existingPid !== null && isRunning(existingPid)) {
    const { port } = getConfig();
    console.log(
      `Server is already running (pid ${existingPid}) on http://localhost:${port}/`
    );
    console.log(`Run \`plxm stop\` to stop it.`);
    process.exit(0);
  }

  if (args.detach) {
    // In a SEA, argv[1] is the executable itself, so the binary is relaunched
    // with no arguments. On Windows, prefer the windowless twin when installed
    // so the background server gets a tray icon and log file.
    const windowless = path.join(
      path.dirname(process.execPath),
      WINDOWLESS_EXE
    );
    const [file, fileArgs] =
      process.platform === "win32" && fs.existsSync(windowless)
        ? [windowless, []]
        : [process.execPath, isSea() ? [] : [process.argv[1]!]];
    const child = spawn(file, fileArgs, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: process.env
    });
    child.unref();
    const { port } = getConfig();
    console.log(
      `Server started in background (pid ${child.pid}) on http://localhost:${port}/`
    );
    console.log(`Run \`plxm stop\` to stop it.`);
    return;
  }

  const { startServer } = await import("./server.js");
  startServer(() => {
    // Without a console, the tray is the only sign the server is running and
    // the only way to stop it short of `plxm stop`.
    if (isWindowless) {
      startTray({
        tooltip: `plxm — listening on port ${getConfig().port}`,
        logPath: LOG_PATH,
        onExit: () => process.exit(0)
      });
    }
  });
}

// Only run when executed directly, not when imported by tests.
if (process.env["VITEST"] === undefined) {
  await main();
}
