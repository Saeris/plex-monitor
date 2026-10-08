import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { logToFile } from "../log.js";

const LOG_FILE = path.join(os.tmpdir(), ".plxm.log-test.log");

afterEach(() => {
  for (const file of [LOG_FILE, `${LOG_FILE}.old`]) {
    fs.rmSync(file, { force: true });
  }
});

describe("logToFile", () => {
  // The windowless binary has no console; a failed Discord send must still
  // leave a trace the user can find.
  it("writes console errors to the log file with a timestamp and level", () => {
    {
      using _ = logToFile(LOG_FILE);
      console.error("Failed to send Discord notification for", "Dune");
    }
    const line = fs.readFileSync(LOG_FILE, "utf8");
    expect(line).toMatch(
      /^\d{4}-\d\d-\d\dT[\d:.]+Z ERROR Failed to send Discord notification for Dune\n$/
    );
  });

  it("appends rather than overwriting earlier entries across restarts", () => {
    fs.writeFileSync(LOG_FILE, "earlier run\n");
    {
      using _ = logToFile(LOG_FILE);
      console.log("Listening");
    }
    const lines = fs.readFileSync(LOG_FILE, "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("earlier run");
    expect(lines[1]).toContain("INFO Listening");
  });

  // A long-running service must not grow its log without bound.
  it("rotates the log to .old once it exceeds 1 MiB", () => {
    fs.writeFileSync(LOG_FILE, "x".repeat(1024 * 1024 + 1));
    {
      using _ = logToFile(LOG_FILE);
      console.log("after rotation");
    }
    expect(fs.statSync(`${LOG_FILE}.old`).size).toBe(1024 * 1024 + 1);
    expect(fs.readFileSync(LOG_FILE, "utf8")).toContain("INFO after rotation");
  });

  it("restores the console when disposed", () => {
    const original = console.log;
    {
      using _ = logToFile(LOG_FILE);
      expect(console.log).not.toBe(original);
    }
    expect(console.log).toBe(original);
  });
});
