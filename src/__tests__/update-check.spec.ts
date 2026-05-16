import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { http, HttpResponse } from "msw";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vite-plus/test";
import { server } from "../../vitest.setup.js";

// Use a per-test temp cache file isolated from ~/.plxm.update-check.json
const CACHE_FILE = path.join(os.tmpdir(), ".plxm.update-check-test.json");
const RELEASES_API_URL =
  "https://api.github.test/repos/saeris/plex-monitor/releases/latest";

// Point the module at our temp paths via env vars (read at module load, so we
// must set them before the dynamic import inside each test).
function setEnv(overrides: Record<string, string | undefined> = {}): void {
  process.env["PLXM_UPDATE_CACHE_PATH"] = CACHE_FILE;
  process.env["PLXM_RELEASES_API"] = RELEASES_API_URL;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function cleanEnv(): void {
  delete process.env["PLXM_UPDATE_CACHE_PATH"];
  delete process.env["PLXM_RELEASES_API"];
  delete process.env["PLXM_NO_UPDATE_CHECK"];
  delete process.env["CI"];
}

function writeCache(data: {
  latest: string;
  checkedAt: number;
  promptedAt: number;
}): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf8");
}

function readCache(): {
  latest: string;
  checkedAt: number;
  promptedAt: number;
} | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as {
      latest: string;
      checkedAt: number;
      promptedAt: number;
    };
  } catch {
    return null;
  }
}

function stubTTY(isTTY: boolean): void {
  Object.defineProperty(process.stderr, "isTTY", {
    configurable: true,
    value: isTTY
  });
}

beforeEach(() => {
  setEnv();
  stubTTY(true);
  try {
    fs.unlinkSync(CACHE_FILE);
  } catch {
    /* no-op */
  }
});

afterEach(() => {
  cleanEnv();
  stubTTY(true);
  try {
    fs.unlinkSync(CACHE_FILE);
  } catch {
    /* no-op */
  }
  vi.resetModules();
});

async function importCheckForUpdate(): Promise<
  (typeof import("../update-check.js"))["checkForUpdate"]
> {
  const mod = await import("../update-check.js?t=" + Date.now());
  return mod.checkForUpdate;
}

// ── TTY gate ─────────────────────────────────────────────────────────────────

describe("TTY gate", () => {
  it("returns null when stderr is not a TTY", async () => {
    stubTTY(false);
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v9.9.9" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });
});

// ── Suppression env vars ──────────────────────────────────────────────────────

describe("suppression env vars", () => {
  it("returns null when PLXM_NO_UPDATE_CHECK is set", async () => {
    setEnv({ PLXM_NO_UPDATE_CHECK: "1" });
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v9.9.9" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });

  it("returns null when CI is set", async () => {
    setEnv({ CI: "true" });
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v9.9.9" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });
});

// ── Version comparison ────────────────────────────────────────────────────────

describe("version comparison", () => {
  it("returns update when patch version is newer", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v1.0.1" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    expect(result).not.toBeNull();
    expect(result?.latest).toBe("1.0.1");
  });

  it("returns update when minor version is newer", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v1.1.0" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).not.toBeNull();
  });

  it("returns update when major version is newer", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v2.0.0" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).not.toBeNull();
  });

  it("returns null when latest equals current", async () => {
    // VERSION in cli.ts is "1.0.0" — same version means no update
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v1.0.0" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });

  it("returns null when latest is older than current", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v0.9.0" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });

  it("strips v-prefix from tag_name", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v1.0.1" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    expect(result?.latest).toBe("1.0.1");
  });

  it("handles tag_name without v-prefix", async () => {
    server.use(
      http.get(RELEASES_API_URL, () => HttpResponse.json({ tag_name: "1.0.1" }))
    );
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    expect(result?.latest).toBe("1.0.1");
  });
});

// ── Cache hit — no fetch ──────────────────────────────────────────────────────

describe("cache hit (fresh, < 24h)", () => {
  it("uses cached version and does not fetch", async () => {
    let fetched = false;
    server.use(
      http.get(RELEASES_API_URL, () => {
        fetched = true;
        return HttpResponse.json({ tag_name: "v9.9.9" });
      })
    );
    writeCache({
      latest: "1.0.1",
      checkedAt: Date.now(),
      promptedAt: 0
    });
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    expect(fetched).toBe(false);
    expect(result?.latest).toBe("1.0.1");
  });

  it("returns null when cached version is current", async () => {
    writeCache({
      latest: "1.0.0",
      checkedAt: Date.now(),
      promptedAt: 0
    });
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });
});

// ── Cache miss — fetch ────────────────────────────────────────────────────────

describe("cache miss (stale or absent)", () => {
  it("fetches when no cache file exists", async () => {
    let fetched = false;
    server.use(
      http.get(RELEASES_API_URL, () => {
        fetched = true;
        return HttpResponse.json({ tag_name: "v1.0.1" });
      })
    );
    const checkForUpdate = await importCheckForUpdate();
    await checkForUpdate();
    expect(fetched).toBe(true);
  });

  it("fetches when cache is stale (> 24h)", async () => {
    let fetched = false;
    server.use(
      http.get(RELEASES_API_URL, () => {
        fetched = true;
        return HttpResponse.json({ tag_name: "v1.0.1" });
      })
    );
    const staleTime = Date.now() - 25 * 60 * 60 * 1000;
    writeCache({ latest: "1.0.0", checkedAt: staleTime, promptedAt: 0 });
    const checkForUpdate = await importCheckForUpdate();
    await checkForUpdate();
    expect(fetched).toBe(true);
  });

  it("writes cache with new latest after successful fetch", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ tag_name: "v1.0.1" })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    await checkForUpdate();
    const cache = readCache();
    expect(cache?.latest).toBe("1.0.1");
    expect(cache?.checkedAt).toBeGreaterThan(0);
  });
});

// ── Fetch failure backoff ─────────────────────────────────────────────────────

describe("fetch failure backoff", () => {
  it("writes checkedAt even when fetch returns a non-ok status", async () => {
    server.use(
      http.get(RELEASES_API_URL, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 })
      )
    );
    const checkForUpdate = await importCheckForUpdate();
    await checkForUpdate();
    const cache = readCache();
    // checkedAt must be set so we back off for 24h instead of retrying every run
    expect(cache?.checkedAt).toBeGreaterThan(0);
    expect(cache?.latest).toBe("");
  });

  it("writes checkedAt even when fetch throws (network error)", async () => {
    server.use(http.get(RELEASES_API_URL, () => HttpResponse.error()));
    const checkForUpdate = await importCheckForUpdate();
    await checkForUpdate();
    const cache = readCache();
    expect(cache?.checkedAt).toBeGreaterThan(0);
  });

  it("preserves previous latest when fetch fails", async () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000;
    writeCache({ latest: "1.0.1", checkedAt: staleTime, promptedAt: 0 });
    server.use(http.get(RELEASES_API_URL, () => HttpResponse.error()));
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    // Should still return the previously cached version
    expect(result?.latest).toBe("1.0.1");
  });
});

// ── Prompt throttle ───────────────────────────────────────────────────────────

describe("prompt throttle", () => {
  it("returns null when user was prompted within 24h", async () => {
    writeCache({
      latest: "1.0.1",
      checkedAt: Date.now(),
      promptedAt: Date.now()
    });
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).toBeNull();
  });

  it("returns update when promptedAt is older than 24h", async () => {
    const stalePrompt = Date.now() - 25 * 60 * 60 * 1000;
    writeCache({
      latest: "1.0.1",
      checkedAt: Date.now(),
      promptedAt: stalePrompt
    });
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).not.toBeNull();
  });

  it("returns update when promptedAt is 0 (never prompted)", async () => {
    writeCache({ latest: "1.0.1", checkedAt: Date.now(), promptedAt: 0 });
    const checkForUpdate = await importCheckForUpdate();
    expect(await checkForUpdate()).not.toBeNull();
  });
});

// ── markPrompted ─────────────────────────────────────────────────────────────

describe("markPrompted", () => {
  it("updates promptedAt in cache when called", async () => {
    writeCache({ latest: "1.0.1", checkedAt: Date.now(), promptedAt: 0 });
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    expect(result).not.toBeNull();

    const before = Date.now();
    result!.markPrompted();
    const cache = readCache();
    expect(cache?.promptedAt).toBeGreaterThanOrEqual(before);
  });

  it("suppresses repeat prompt after markPrompted", async () => {
    writeCache({ latest: "1.0.1", checkedAt: Date.now(), promptedAt: 0 });
    const checkForUpdate = await importCheckForUpdate();
    const result = await checkForUpdate();
    result!.markPrompted();

    // Second call with fresh cache (still within 24h) — should not prompt
    vi.resetModules();
    const checkForUpdate2 = await importCheckForUpdate();
    expect(await checkForUpdate2()).toBeNull();
  });
});

// ── Corrupt cache ─────────────────────────────────────────────────────────────

describe("corrupt cache", () => {
  it("treats corrupt cache as a cache miss and fetches", async () => {
    fs.writeFileSync(CACHE_FILE, "not valid json", "utf8");
    let fetched = false;
    server.use(
      http.get(RELEASES_API_URL, () => {
        fetched = true;
        return HttpResponse.json({ tag_name: "v1.0.1" });
      })
    );
    const checkForUpdate = await importCheckForUpdate();
    await checkForUpdate();
    expect(fetched).toBe(true);
  });
});
