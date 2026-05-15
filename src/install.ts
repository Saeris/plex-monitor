import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";

const BINARY_NAME = "plxm";
const LAUNCHD_LABEL = "io.github.saeris.plxm";
const SYSTEMD_UNIT = "plxm.service";
const TASK_NAME = "plxm";

// Filled in at release time — points to the GitHub Releases download base URL.
const RELEASE_BASE_URL =
  "https://github.com/saeris/plex-monitor/releases/latest/download";

function getBinDir(): string {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
      "Programs",
      BINARY_NAME
    );
  }
  return path.join(os.homedir(), ".local", "bin");
}

function getInstalledBinPath(): string {
  if (process.platform === "win32")
    return path.join(getBinDir(), `${BINARY_NAME}.exe`);
  return path.join(getBinDir(), BINARY_NAME);
}

function getLaunchdPlistPath(): string {
  return path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${LAUNCHD_LABEL}.plist`
  );
}

function getSystemdUnitPath(): string {
  return path.join(os.homedir(), ".config", "systemd", "user", SYSTEMD_UNIT);
}

function currentBinaryPath(): string {
  return process.execPath;
}

function isSeaBinary(): boolean {
  // When bundled as a Node SEA, the main script is embedded — process.argv[1]
  // will be the same file as process.execPath.
  return process.execPath === process.argv[1];
}

function exec(cmd: string): void {
  execSync(cmd, { stdio: "inherit" });
}

function execSilent(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

// ── macOS (launchd) ──────────────────────────────────────────────────────────

function launchdPlist(binaryPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binaryPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(os.homedir(), "Library", "Logs", `${BINARY_NAME}.log`)}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(os.homedir(), "Library", "Logs", `${BINARY_NAME}.error.log`)}</string>
</dict>
</plist>
`;
}

function installMacos(binaryPath: string): void {
  const plistPath = getLaunchdPlistPath();
  fs.writeFileSync(plistPath, launchdPlist(binaryPath), "utf8");
  try {
    exec(`launchctl bootstrap gui/$(id -u) "${plistPath}"`);
  } catch {
    // Already loaded — swap the definition instead.
    exec(`launchctl unload "${plistPath}" 2>/dev/null || true`);
    exec(`launchctl load "${plistPath}"`);
  }
}

function uninstallMacos(): void {
  const plistPath = getLaunchdPlistPath();
  if (fs.existsSync(plistPath)) {
    try {
      exec(`launchctl bootout gui/$(id -u) "${plistPath}"`);
    } catch {
      /* already unloaded */
    }
    fs.unlinkSync(plistPath);
  }
}

// ── Linux (systemd user) ─────────────────────────────────────────────────────

function systemdUnit(binaryPath: string): string {
  return `[Unit]
Description=Plex Monitor — Discord notification relay
After=network.target

[Service]
Type=simple
ExecStart=${binaryPath}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}

function installLinux(binaryPath: string): void {
  const unitPath = getSystemdUnitPath();
  fs.mkdirSync(path.dirname(unitPath), { recursive: true });
  fs.writeFileSync(unitPath, systemdUnit(binaryPath), "utf8");
  exec("systemctl --user daemon-reload");
  exec(`systemctl --user enable --now ${SYSTEMD_UNIT}`);
}

function uninstallLinux(): void {
  const unitPath = getSystemdUnitPath();
  if (fs.existsSync(unitPath)) {
    try {
      exec(`systemctl --user disable --now ${SYSTEMD_UNIT}`);
    } catch {
      /* already stopped */
    }
    fs.unlinkSync(unitPath);
    exec("systemctl --user daemon-reload");
  }
}

// ── Windows (Task Scheduler) ─────────────────────────────────────────────────

function taskXml(binaryPath: string): string {
  // Run via node.exe explicitly so Task Scheduler doesn't open a visible
  // console window when launching the .mjs bundle.
  const isBundle = binaryPath.endsWith(".mjs");
  const command = isBundle ? process.execPath : binaryPath;
  const args = isBundle ? `<Arguments>"${binaryPath}"</Arguments>` : "";
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${execSilent("whoami")}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Hidden>true</Hidden>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions>
    <Exec>
      <Command>"${command}"</Command>
      ${args}
    </Exec>
  </Actions>
</Task>
`;
}

function installWindows(binaryPath: string): void {
  const xmlPath = path.join(os.tmpdir(), `${TASK_NAME}-task.xml`);
  const bom = Buffer.from([0xff, 0xfe]);
  const content = Buffer.from(taskXml(binaryPath), "utf16le");
  fs.writeFileSync(xmlPath, Buffer.concat([bom, content]));
  exec(`schtasks /Create /TN "${TASK_NAME}" /XML "${xmlPath}" /F`);
  exec(`schtasks /Run /TN "${TASK_NAME}"`);
  fs.unlinkSync(xmlPath);
}

function uninstallWindows(): void {
  try {
    exec(`schtasks /End /TN "${TASK_NAME}"`);
  } catch {
    /* not running */
  }
  try {
    exec(`schtasks /Delete /TN "${TASK_NAME}" /F`);
  } catch {
    /* not registered */
  }
  const binDir = getBinDir();
  const binPath = getInstalledBinPath();
  if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
  try {
    fs.rmdirSync(binDir);
  } catch {
    /* not empty or already gone */
  }
}

// ── PATH helper ──────────────────────────────────────────────────────────────

function addToPathShellRc(binDir: string): void {
  const exportLine = `export PATH="${binDir}:$PATH"`;
  const rcFiles = [".bashrc", ".zshrc", ".profile"].map((f) =>
    path.join(os.homedir(), f)
  );
  for (const rc of rcFiles) {
    if (!fs.existsSync(rc)) continue;
    const content = fs.readFileSync(rc, "utf8");
    if (content.includes(binDir)) continue;
    fs.appendFileSync(rc, `\n# Added by plxm install\n${exportLine}\n`, "utf8");
  }
}

function addToPathWindows(binDir: string): void {
  // Append to the user-level PATH in the registry via setx.
  const current = execSilent(
    `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('PATH', 'User')"`
  );
  if (!current.includes(binDir)) {
    const updated = `${current};${binDir}`;
    execSilent(
      `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('PATH', '${updated}', 'User')"`
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function runInstall(
  runInitIfNeeded: () => Promise<void>
): Promise<void> {
  p.intro(`${BINARY_NAME} install`);

  const src = currentBinaryPath();
  const dest = getInstalledBinPath();
  const binDir = getBinDir();

  // Copy binary to install location (only meaningful for SEA downloads).
  if (isSeaBinary() && src !== dest) {
    p.log.step(`Copying binary to ${dest}`);
    fs.mkdirSync(binDir, { recursive: true });
    fs.copyFileSync(src, dest);
    if (process.platform !== "win32") {
      fs.chmodSync(dest, 0o755);
    }
  }

  // Register autostart service.
  const binaryPath = isSeaBinary() ? dest : src;
  p.log.step("Registering autostart service");
  if (process.platform === "darwin") {
    installMacos(binaryPath);
  } else if (process.platform === "linux") {
    installLinux(binaryPath);
  } else if (process.platform === "win32") {
    installWindows(binaryPath);
  } else {
    p.log.warn(
      `Autostart not supported on ${process.platform} — start manually with: ${BINARY_NAME}`
    );
  }

  // Add to PATH for SEA installs on POSIX systems.
  if (isSeaBinary()) {
    if (process.platform === "win32") {
      addToPathWindows(binDir);
      p.log.info(`Added ${binDir} to your user PATH (restart your terminal)`);
    } else {
      addToPathShellRc(binDir);
      p.log.info(
        `Added ${binDir} to PATH in your shell rc files (restart your terminal or run: source ~/.bashrc)`
      );
    }
  }

  await runInitIfNeeded();

  p.outro("Installation complete. plxm will start automatically on login.");
}

export async function runUninstall(): Promise<void> {
  p.intro(`${BINARY_NAME} uninstall`);

  p.log.step("Stopping and removing autostart service");
  if (process.platform === "darwin") {
    uninstallMacos();
  } else if (process.platform === "linux") {
    uninstallLinux();
  } else if (process.platform === "win32") {
    uninstallWindows();
  }

  p.outro(
    `${BINARY_NAME} has been uninstalled. Your config file at ${path.join(os.homedir(), ".plex-monitor.config.json")} was not removed.`
  );
}

export async function runUpgrade(): Promise<void> {
  p.intro(`${BINARY_NAME} upgrade`);

  const platform = process.platform;
  const arch = process.arch;

  const platformMap: Record<string, string> = {
    darwin: "darwin",
    linux: "linux",
    win32: "win"
  };
  const archMap: Record<string, string> = {
    x64: "x64",
    arm64: "arm64"
  };

  const plat = platformMap[platform];
  const ar = archMap[arch];

  if (!plat || !ar) {
    p.log.error(`Unsupported platform: ${platform}/${arch}`);
    process.exit(1);
  }

  const ext = platform === "win32" ? ".exe" : "";
  const fileName = `${BINARY_NAME}-${plat}-${ar}${ext}`;
  const url = `${RELEASE_BASE_URL}/${fileName}`;

  p.log.step(`Downloading latest release from:\n  ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    p.log.error(`Download failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const dest = getInstalledBinPath();
  const tmp = `${dest}.tmp`;

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(tmp, Buffer.from(buffer));
  if (platform !== "win32") fs.chmodSync(tmp, 0o755);

  // Stop service before replacing binary.
  p.log.step("Stopping service");
  if (platform === "darwin") {
    try {
      exec(`launchctl stop ${LAUNCHD_LABEL}`);
    } catch {
      /* not running */
    }
  } else if (platform === "linux") {
    try {
      exec(`systemctl --user stop ${SYSTEMD_UNIT}`);
    } catch {
      /* not running */
    }
  } else if (platform === "win32") {
    try {
      exec(`schtasks /End /TN "${TASK_NAME}"`);
    } catch {
      /* not running */
    }
  }

  fs.renameSync(tmp, dest);
  p.log.step("Binary replaced");

  // Restart service.
  p.log.step("Restarting service");
  if (platform === "darwin") {
    exec(`launchctl start ${LAUNCHD_LABEL}`);
  } else if (platform === "linux") {
    exec(`systemctl --user start ${SYSTEMD_UNIT}`);
  } else if (platform === "win32") {
    exec(`schtasks /Run /TN "${TASK_NAME}"`);
  }

  p.outro(`${BINARY_NAME} upgraded successfully.`);
}
