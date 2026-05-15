import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as v from "valibot";

const CONFIG_PATH =
  process.env.PLEX_MONITOR_CONFIG_PATH ??
  path.join(os.homedir(), ".plex-monitor.config.json");

export const DEFAULT_PORT = 7539; // P-L-E-X on a phone dialpad

const ConfigSchema = v.object({
  port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
  discordWebhookUrl: v.pipe(v.string(), v.url()),
  tmdbApiKey: v.pipe(v.string(), v.minLength(1))
});

export type Config = v.InferOutput<typeof ConfigSchema>;

export type PartialConfig = Partial<Config>;

function readConfigFile(): PartialConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as PartialConfig;
  } catch {
    return {};
  }
}

export function writeConfig(values: PartialConfig): void {
  const existing = readConfigFile();
  const merged = { ...existing, ...values };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");
}

export function loadConfig(): Config {
  const file = readConfigFile();
  const result = v.safeParse(ConfigSchema, file);
  if (!result.success) {
    const missing = result.issues
      .map((i) => i.path?.map((p) => p.key).join(".") ?? "unknown")
      .join(", ");
    throw new Error(
      `Invalid or incomplete config at ${CONFIG_PATH}. Missing/invalid fields: ${missing}\nRun \`plex-monitor init\` to set up your configuration.`
    );
  }
  return result.output;
}

export function configExists(): boolean {
  try {
    fs.accessSync(CONFIG_PATH, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export const CONFIG_PATH_DISPLAY = CONFIG_PATH;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
