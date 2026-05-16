import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { VERSION } from "./cli.js";

const CACHE_FILE = path.join(os.homedir(), ".plxm.update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RELEASES_API =
  "https://api.github.com/repos/saeris/plex-monitor/releases/latest";

interface UpdateCheckCache {
  latest: string;
  checkedAt: number;
  promptedAt: number;
}

function readCache(): UpdateCheckCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as UpdateCheckCache;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCheckCache): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf8");
  } catch {
    /* ignore write failures */
  }
}

function nowMs(): number {
  return Date.now();
}

function isNewer(current: string, latest: string): boolean {
  if (!latest || current === "0.0.0") return false;
  const parse = (v: string): number[] =>
    v.replace(/^v/, "").split(".").map(Number);
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
  const [lMaj = 0, lMin = 0, lPat = 0] = parse(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

function shouldCheck(cache: UpdateCheckCache | null, now: number): boolean {
  if (process.env["PLXM_NO_UPDATE_CHECK"] ?? process.env["CI"]) return false;
  return cache === null || now - cache.checkedAt > CHECK_INTERVAL_MS;
}

function shouldPrompt(cache: UpdateCheckCache | null, now: number): boolean {
  return cache === null || now - cache.promptedAt > PROMPT_INTERVAL_MS;
}

export interface UpdateAvailable {
  latest: string;
  markPrompted: () => void;
}

export async function checkForUpdate(): Promise<UpdateAvailable | null> {
  if (!process.stderr.isTTY) return null;

  const now = nowMs();
  let cache = readCache();

  if (shouldCheck(cache, now)) {
    const promptedAt = cache?.promptedAt ?? 0;
    try {
      const res = await fetch(RELEASES_API, {
        headers: { "User-Agent": `plxm/${VERSION}` },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = (await res.json()) as { tag_name: string };
        const latest = data.tag_name.replace(/^v/, "");
        cache = { latest, checkedAt: now, promptedAt };
        writeCache(cache);
      } else {
        cache = { latest: cache?.latest ?? "", checkedAt: now, promptedAt };
        writeCache(cache);
      }
    } catch {
      cache = { latest: cache?.latest ?? "", checkedAt: now, promptedAt };
      writeCache(cache);
    }
  }

  if (!cache?.latest || !isNewer(VERSION, cache.latest)) return null;
  if (!shouldPrompt(cache, now)) return null;

  return {
    latest: cache.latest,
    markPrompted: () => {
      writeCache({ ...cache!, promptedAt: nowMs() });
    }
  };
}
