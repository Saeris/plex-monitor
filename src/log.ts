import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { format } from "node:util";

export const LOG_PATH = path.join(os.homedir(), ".plxm.log");

// Once the log passes this size it's moved to `<log>.old`, keeping at most
// two files around for a service that may run for months.
const MAX_LOG_BYTES = 1024 * 1024;

/**
 * Redirects console output to a log file. Used by the windowless binary,
 * which has no console: without this, errors (e.g. failed Discord sends)
 * would disappear silently.
 */
export function logToFile(logPath = LOG_PATH): Disposable {
  const original = { ...console };
  const write =
    (level: string) =>
    (...args: unknown[]): void => {
      try {
        if (fs.statSync(logPath).size > MAX_LOG_BYTES) {
          fs.renameSync(logPath, `${logPath}.old`);
        }
      } catch {
        /* no log yet */
      }
      fs.appendFileSync(
        logPath,
        `${new Date().toISOString()} ${level} ${format(...args)}\n`,
        "utf8"
      );
    };

  console.log = write("INFO");
  console.info = write("INFO");
  console.warn = write("WARN");
  console.error = write("ERROR");

  // Node reports fatal errors straight to stderr, bypassing console.error.
  const onFatal = (err: Error): void => {
    console.error("Uncaught exception:", err);
    process.exit(1);
  };
  process.on("uncaughtException", onFatal);

  return {
    [Symbol.dispose]() {
      Object.assign(console, original);
      process.off("uncaughtException", onFatal);
    }
  };
}
