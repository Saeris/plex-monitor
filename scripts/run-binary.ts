// Runs the standalone binary `vp pack` built for this machine, forwarding
// arguments, e.g. `node scripts/run-binary.ts install`.
import { execFileSync } from "node:child_process";
import * as path from "node:path";

const platform = { win32: "win", darwin: "darwin", linux: "linux" }[
  process.platform as "win32" | "darwin" | "linux"
];
const ext = process.platform === "win32" ? ".exe" : "";
const binary = path.join(
  import.meta.dirname,
  "..",
  "build",
  `plxm-${platform}-${process.arch}${ext}`
);

execFileSync(binary, process.argv.slice(2), { stdio: "inherit" });
