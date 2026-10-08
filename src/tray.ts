import { spawn } from "node:child_process";

// GUI-subsystem twin of plxm.exe, created by `plxm install`. Windows never
// allocates a console for it, so it's what autostart launches.
export const WINDOWLESS_EXE = "plxmw.exe";

// Single-quoted PowerShell literal: only embedded quotes need escaping.
const psString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

// The tray runs in a hidden PowerShell process (WinForms NotifyIcon) so we need
// no native dependencies. It reports "exit" on stdout when the user picks Exit,
// and polls our PID so the icon disappears even if we're killed outright.
function trayScript(tooltip: string, logPath: string): string {
  return `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon(${psString(process.execPath)})
$icon.Text = ${psString(tooltip)}
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$status = $menu.Items.Add(${psString(tooltip)})
$status.Enabled = $false
[void]$menu.Items.Add('-')
$log = $menu.Items.Add('Open log')
$log.add_Click({ Start-Process ${psString(logPath)} })
$exit = $menu.Items.Add('Exit')
$exit.add_Click({ [Console]::Out.WriteLine('exit'); [Console]::Out.Flush(); [System.Windows.Forms.Application]::Exit() })
$icon.ContextMenuStrip = $menu
$icon.Visible = $true
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.add_Tick({ if (-not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue)) { [System.Windows.Forms.Application]::Exit() } })
$timer.Start()
[System.Windows.Forms.Application]::Run()
$icon.Visible = $false
$icon.Dispose()
`;
}

export function startTray({
  tooltip,
  logPath,
  onExit
}: {
  tooltip: string;
  logPath: string;
  onExit: () => void;
}): void {
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      Buffer.from(trayScript(tooltip, logPath), "utf16le").toString("base64")
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );

  child.stdout.on("data", (chunk: Buffer) => {
    if (chunk.toString().includes("exit")) onExit();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    console.error("Tray error:", chunk.toString().trim());
  });
  child.on("error", (err) => {
    console.error("Failed to start tray icon:", err.message);
  });
  process.on("exit", () => child.kill());
}
