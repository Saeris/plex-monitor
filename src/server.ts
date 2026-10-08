import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { getConfig } from "./config.js";
import { handleWebhook } from "./index.js";

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

/**
 * Stops the server recorded in the PID file, waiting for it to exit so its
 * binary can be replaced (Windows locks running executables).
 * Returns the stopped PID, or null if no server was running.
 */
export async function stopServer(): Promise<number | null> {
  const pid = readPid();
  if (pid === null || !isRunning(pid)) {
    clearPid();
    return null;
  }
  process.kill(pid, "SIGTERM");
  for (let i = 0; i < 50 && isRunning(pid); i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  clearPid();
  return pid;
}

// Adapts Node's request to a Fetch API Request. Only the content type is
// forwarded: it carries the multipart boundary formData() needs.
function toRequest(req: http.IncomingMessage): Request {
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://localhost${req.url ?? "/"}`, {
    method: req.method,
    headers: { "content-type": req.headers["content-type"] ?? "" },
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    duplex: "half"
  });
}

export function startServer(onReady?: () => void): void {
  const { port } = getConfig();

  writePid();
  process.on("exit", clearPid);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  const server = http.createServer(async (req, res) => {
    try {
      const response = await handleWebhook(toRequest(req));
      res.writeHead(response.status, {
        "content-type": response.headers.get("content-type") ?? "text/plain"
      });
      res.end(await response.text());
    } catch (err) {
      console.error(
        "Request failed:",
        err instanceof Error ? err.message : err
      );
      res.writeHead(500).end();
    }
  });

  server.listen(port, () => {
    console.log("plex-monitor");
    console.log(`Listening on http://localhost:${port}`);
    console.log(`Webhook endpoint: POST http://localhost:${port}/`);
    onReady?.();
  });
}
