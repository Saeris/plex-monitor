import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getConfig } from "./config.js";
import { app } from "./index.js";

const PID_FILE = path.join(os.homedir(), ".plxm.pid");

export function writePid(): void {
  fs.writeFileSync(PID_FILE, String(process.pid), "utf8");
}

export function clearPid(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* already gone */
  }
}

export function readPid(): number | null {
  try {
    const raw = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function isRunning(pid: number): boolean {
  try {
    // Signal 0 checks existence without killing the process.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startServer(): void {
  const { port } = getConfig();

  writePid();
  process.on("exit", clearPid);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  app.listen(port, () => {
    console.log("plex-monitor");
    console.log(`Listening on http://localhost:${port}`);
    console.log(`Webhook endpoint: POST http://localhost:${port}/`);
  });
}
