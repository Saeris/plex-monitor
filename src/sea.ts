import type mri from "mri";
import { main, HELP } from "./cli.js";

const SEA_HELP = {
  ...HELP,
  "": HELP[""].replace(
    "  stop                 Stop a running background server",
    "  stop                 Stop a running background server\n  upgrade              Download the latest release and restart the service"
  ),
  upgrade: `
Usage: plxm upgrade

Downloads the latest release binary for your platform from GitHub Releases,
stops the running service, replaces the binary, and restarts the service.

Only supported for standalone binary installs. To upgrade an npm global
install, run: npm install -g @saeris/plex-monitor
`.trim()
};

await main(SEA_HELP, async (command: string, _args: ReturnType<typeof mri>) => {
  if (command === "upgrade") {
    const { runUpgrade } = await import("./install.js");
    await runUpgrade();
    return true;
  }
  return false;
});
