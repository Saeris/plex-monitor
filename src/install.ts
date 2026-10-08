import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { isSea } from "node:sea";
import * as p from "@clack/prompts";
import { stopServer } from "./server.js";
import { WINDOWLESS_EXE } from "./tray.js";

const BINARY_NAME = "plxm";
const LAUNCHD_LABEL = "io.github.saeris.plxm";
const SYSTEMD_UNIT = "plxm.service";
const TASK_NAME = "plxm";

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

function getInstalledWindowlessPath(): string {
  return path.join(getBinDir(), WINDOWLESS_EXE);
}

// PE optional header "Subsystem" field: 2 = Windows GUI, 3 = console.
const PE_SUBSYSTEM_GUI = 2;

/**
 * Returns a copy of a Windows executable marked as a GUI-subsystem program.
 * Windows only allocates a console window for console-subsystem programs, so
 * the copy runs with no window at all (the `javaw.exe` / `pythonw.exe` trick).
 */
export function makeWindowless(exe: Buffer): Buffer {
  const peOffset =
    exe.length >= 0x40 && exe.toString("latin1", 0, 2) === "MZ"
      ? exe.readUInt32LE(0x3c)
      : -1;
  if (
    peOffset < 0 ||
    exe.toString("latin1", peOffset, peOffset + 4) !== "PE\0\0"
  ) {
    throw new Error("Not a Windows executable");
  }
  const copy = Buffer.from(exe);
  // Skip the 4-byte signature and 20-byte COFF header; Subsystem is at +68.
  copy.writeUInt16LE(PE_SUBSYSTEM_GUI, peOffset + 24 + 68);
  return copy;
}

function writeWindowlessCopy(): void {
  fs.writeFileSync(
    getInstalledWindowlessPath(),
    makeWindowless(fs.readFileSync(getInstalledBinPath()))
  );
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
  // Note: <Hidden> only hides the task in the Task Scheduler UI. Pass the
  // windowless twin so no console window appears.
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
      <Command>"${binaryPath}"</Command>
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
  for (const binPath of [getInstalledBinPath(), getInstalledWindowlessPath()]) {
    if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
  }
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

  // The service runs the self-contained binary; under plain Node there's no
  // binary to copy and the service would depend on a particular Node install.
  if (!isSea()) {
    p.cancel(
      "Install from the standalone binary instead: run `vp run plxm:install` in the repo."
    );
    process.exit(1);
  }

  const src = process.execPath;
  const dest = getInstalledBinPath();
  const binDir = getBinDir();

  // A running server locks its binary on Windows, so stop it before copying.
  const stoppedPid = await stopServer();
  if (stoppedPid !== null)
    p.log.step(`Stopped running server (pid ${stoppedPid})`);

  if (src !== dest) {
    p.log.step(`Copying binary to ${dest}`);
    fs.mkdirSync(binDir, { recursive: true });
    fs.copyFileSync(src, dest);
    if (process.platform !== "win32") {
      fs.chmodSync(dest, 0o755);
    }
  }

  // Windows autostart launches the windowless twin so no console appears.
  if (process.platform === "win32") {
    p.log.step(`Creating windowless binary ${getInstalledWindowlessPath()}`);
    writeWindowlessCopy();
  }

  // Configure before registering: the service starts immediately, and the
  // windowless binary exits if there's no valid config.
  await runInitIfNeeded();

  const binaryPath =
    process.platform === "win32" ? getInstalledWindowlessPath() : dest;
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

  if (process.platform === "win32") {
    addToPathWindows(binDir);
    p.log.info(`Added ${binDir} to your user PATH (restart your terminal)`);
  } else {
    addToPathShellRc(binDir);
    p.log.info(
      `Added ${binDir} to PATH in your shell rc files (restart your terminal or run: source ~/.bashrc)`
    );
  }

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
