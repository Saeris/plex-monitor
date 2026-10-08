import { describe, expect, it, vi } from "vite-plus/test";
import pkg from "../../package.json" with { type: "json" };
import { HELP, VERSION, showHelp } from "../cli.js";

// ── Disposable helpers ────────────────────────────────────────────────────────

function captureConsole(): {
  stdout: () => string;
  stderr: () => string;
  [Symbol.dispose](): void;
} {
  const outLines: string[] = [];
  const errLines: string[] = [];
  vi.stubGlobal("console", {
    log: (...args: unknown[]) => outLines.push(args.join(" ")),
    error: (...args: unknown[]) => errLines.push(args.join(" ")),
    warn: (...args: unknown[]) => errLines.push(args.join(" ")),
    info: (...args: unknown[]) => outLines.push(args.join(" ")),
    debug: () => {}
  });
  return {
    stdout: () => outLines.join("\n"),
    stderr: () => errLines.join("\n"),
    [Symbol.dispose]() {
      vi.unstubAllGlobals();
    }
  };
}

function saveArgv(): { [Symbol.dispose](): void } {
  const saved = process.argv;
  return {
    [Symbol.dispose]() {
      process.argv = saved;
    }
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

describe("VERSION", () => {
  // `plxm --version` must identify the build; a hard-coded copy once drifted
  // out of sync with package.json.
  it("matches the package.json version", () => {
    expect(VERSION).toBe(pkg.version);
  });
});

describe("HELP", () => {
  it("contains entries for all base commands", () => {
    for (const key of ["", "install", "uninstall", "init", "config", "stop"]) {
      expect(HELP[key]).toBeDefined();
    }
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
    log.mockRestore();
    expect(output).toContain("Unknown command: notacommand");
    expect(output).toContain(HELP[""]);
  });
});

// ── main() — unknown commands ─────────────────────────────────────────────────

describe("main() unknown command", () => {
  // A typo must fail loudly rather than fall through to starting the server.
  it("reports the command and exits instead of starting the server", async () => {
    const { main } = await import("../cli.js");
    using cap = captureConsole();
    using _argv = saveArgv();
    let exitCalled = false;

    process.argv = ["node", "cli.js", "upgrade"];
    try {
      await main();
    } catch (e) {
      // Vitest intercepts process.exit and throws — that confirms exit was called
      exitCalled = true;
      if (!(e instanceof Error) || !e.message.includes("process.exit")) throw e;
    }

    expect(cap.stderr()).toContain("Unknown command: upgrade");
    expect(exitCalled).toBe(true);
  });
});

// ── main() — version flag ─────────────────────────────────────────────────────

describe("main() --version", () => {
  it("prints the version and returns without running a command", async () => {
    const { main } = await import("../cli.js");
    using cap = captureConsole();
    using _argv = saveArgv();

    process.argv = ["node", "cli.js", "--version"];
    await main();

    expect(cap.stdout()).toContain(`plxm v${VERSION}`);
  });

  it("-v alias also prints version", async () => {
    const { main } = await import("../cli.js");
    using cap = captureConsole();
    using _argv = saveArgv();

    process.argv = ["node", "cli.js", "-v"];
    await main();

    expect(cap.stdout()).toContain(`plxm v${VERSION}`);
  });
});

// ── main() — help flag ────────────────────────────────────────────────────────

describe("main() help", () => {
  it("plxm --help prints root help", async () => {
    const { main } = await import("../cli.js");
    using cap = captureConsole();
    using _argv = saveArgv();

    process.argv = ["node", "cli.js", "--help"];
    await main();

    expect(cap.stdout()).toContain("Usage: plxm");
  });

  it("plxm help init prints init help", async () => {
    const { main } = await import("../cli.js");
    using cap = captureConsole();
    using _argv = saveArgv();

    process.argv = ["node", "cli.js", "help", "init"];
    await main();

    expect(cap.stdout()).toContain("Usage: plxm init");
  });
});
