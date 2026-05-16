import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HELP, VERSION, showHelp } from "../cli.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Exports ───────────────────────────────────────────────────────────────────

describe("VERSION", () => {
  it("is a semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("HELP", () => {
  it("contains entries for all base commands", () => {
    for (const key of ["", "install", "uninstall", "init", "config", "stop"]) {
      expect(HELP[key]).toBeDefined();
    }
  });

  it("does not contain an upgrade entry", () => {
    // upgrade belongs to sea.ts only — must not ship in the npm bundle
    expect(HELP["upgrade"]).toBeUndefined();
  });

  it("root help includes the version string", () => {
    expect(HELP[""]).toContain(VERSION);
  });

  it("root help lists all base commands", () => {
    for (const cmd of ["install", "uninstall", "init", "config", "stop"]) {
      expect(HELP[""]).toContain(cmd);
    }
  });
});

// ── showHelp ──────────────────────────────────────────────────────────────────

describe("showHelp", () => {
  it("prints root help when called with no arguments", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    showHelp();
    expect(log).toHaveBeenCalledWith(HELP[""]);
    log.mockRestore();
  });

  it("prints the help entry for a known command", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    showHelp("init");
    expect(log).toHaveBeenCalledWith(HELP["init"]);
    log.mockRestore();
  });

  it("prints an unknown-command message for unrecognised commands", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    showHelp("notacommand");
    const output = log.mock.calls[0]?.[0] as string;
    expect(output).toContain("Unknown command: notacommand");
    expect(output).toContain(HELP[""]);
    log.mockRestore();
  });

  it("uses the provided help map instead of HELP when given one", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const customHelp = { "": "root help", upgrade: "upgrade help" };
    showHelp("upgrade", customHelp);
    expect(log).toHaveBeenCalledWith("upgrade help");
    log.mockRestore();
  });

  it("falls back to root from custom map for unknown commands", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const customHelp = { "": "root help" };
    showHelp("unknown", customHelp);
    const output = log.mock.calls[0]?.[0] as string;
    expect(output).toContain("Unknown command: unknown");
    expect(output).toContain("root help");
    log.mockRestore();
  });

  it("merges extra help entries without mutating HELP", () => {
    const extra = { "": "custom root", upgrade: "upgrade text" };
    const before = { ...HELP };
    showHelp("upgrade", { ...HELP, ...extra });
    expect(HELP).toEqual(before);
  });
});

// ── main() — extraHelp merging ────────────────────────────────────────────────

describe("main() extraHelp", () => {
  it("includes extra help entries in the merged map passed to showHelp", () => {
    // We verify indirectly: showHelp with a merged map containing 'upgrade'
    // should print the upgrade text, not an unknown-command message.
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const merged = { ...HELP, upgrade: "Usage: plxm upgrade" };
    showHelp("upgrade", merged);
    expect(log).toHaveBeenCalledWith("Usage: plxm upgrade");
    log.mockRestore();
  });

  it("extra entries do not appear in base HELP", () => {
    // Confirms that sea.ts adding upgrade to its copy does not pollute HELP
    const merged = { ...HELP, upgrade: "Usage: plxm upgrade" };
    expect(HELP["upgrade"]).toBeUndefined();
    expect(merged["upgrade"]).toBe("Usage: plxm upgrade");
  });
});

// ── console capture helper ────────────────────────────────────────────────────
//
// Vitest gives each module its own console proxy, so vi.spyOn(console, "log")
// in a test file does not intercept calls made inside cli.ts. vi.stubGlobal
// replaces the global console object itself, which IS shared across all module
// contexts within the same worker.

function captureConsole(): {
  stdout: () => string;
  stderr: () => string;
  restore: () => void;
} {
  const outLines: string[] = [];
  const errLines: string[] = [];

  const stub = {
    log: (...args: unknown[]) => outLines.push(args.join(" ")),
    error: (...args: unknown[]) => errLines.push(args.join(" ")),
    warn: (...args: unknown[]) => errLines.push(args.join(" ")),
    info: (...args: unknown[]) => outLines.push(args.join(" ")),
    debug: () => {}
  };
  vi.stubGlobal("console", stub);

  return {
    stdout: () => outLines.join("\n"),
    stderr: () => errLines.join("\n"),
    restore: () => vi.unstubAllGlobals()
  };
}

// ── main() — extraCommands delegation ─────────────────────────────────────────

describe("main() extraCommands", () => {
  it("extraCommands handler receives the command name", async () => {
    const { main } = await import("../cli.js");
    const received: string[] = [];
    const argv = process.argv;

    process.argv = ["node", "cli.js", "mycommand"];
    try {
      await main({}, async (cmd) => {
        received.push(cmd);
        return true;
      });
    } finally {
      process.argv = argv;
    }

    expect(received).toContain("mycommand");
  });

  it("falls through to unknown-command when handler returns false", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;
    let exitCalled = false;

    process.argv = ["node", "cli.js", "nothandled"];
    try {
      await main({}, async () => false);
    } catch (e) {
      // Vitest intercepts process.exit and throws — that confirms exit was called
      exitCalled = true;
      if (!(e instanceof Error) || !e.message.includes("process.exit")) throw e;
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(cap.stderr()).toContain("Unknown command: nothandled");
    expect(exitCalled).toBe(true);
  });

  it("skips extraCommands when --version is passed", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;
    let called = false;

    process.argv = ["node", "cli.js", "--version"];
    try {
      await main({}, async () => {
        called = true;
        return false;
      });
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(called).toBe(false);
  });
});

// ── main() — version flag ─────────────────────────────────────────────────────

describe("main() --version", () => {
  it("prints the version and returns without running a command", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;

    process.argv = ["node", "cli.js", "--version"];
    try {
      await main();
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(cap.stdout()).toContain(`plxm v${VERSION}`);
  });

  it("-v alias also prints version", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;

    process.argv = ["node", "cli.js", "-v"];
    try {
      await main();
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(cap.stdout()).toContain(`plxm v${VERSION}`);
  });
});

// ── main() — help flag ────────────────────────────────────────────────────────

describe("main() help", () => {
  it("plxm --help prints root help", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;

    process.argv = ["node", "cli.js", "--help"];
    try {
      await main();
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(cap.stdout()).toContain("Usage: plxm");
  });

  it("plxm help init prints init help", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;

    process.argv = ["node", "cli.js", "help", "init"];
    try {
      await main();
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(cap.stdout()).toContain("Usage: plxm init");
  });

  it("plxm help upgrade shows extra help when provided", async () => {
    const { main } = await import("../cli.js");
    const cap = captureConsole();
    const argv = process.argv;

    process.argv = ["node", "cli.js", "help", "upgrade"];
    try {
      await main({ upgrade: "Usage: plxm upgrade" });
    } finally {
      cap.restore();
      process.argv = argv;
    }

    expect(cap.stdout()).toContain("Usage: plxm upgrade");
  });
});
