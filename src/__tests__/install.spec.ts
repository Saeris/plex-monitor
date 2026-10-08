import { describe, expect, it } from "vite-plus/test";
import { makeWindowless } from "../install.js";

const PE_OFFSET = 0x80;
const SUBSYSTEM_OFFSET = PE_OFFSET + 24 + 68;

// Minimal PE image: just the headers makeWindowless reads and writes.
function fakeExe(subsystem: number): Buffer {
  const exe = Buffer.alloc(0x200);
  exe.write("MZ", 0, "latin1");
  exe.writeUInt32LE(PE_OFFSET, 0x3c);
  exe.write("PE\0\0", PE_OFFSET, "latin1");
  exe.writeUInt16LE(subsystem, SUBSYSTEM_OFFSET);
  return exe;
}

describe("makeWindowless", () => {
  // Windows allocates a console window for subsystem 3 binaries; autostart
  // must launch a subsystem 2 (GUI) binary so no window ever appears.
  it("marks a console executable as a GUI-subsystem executable", () => {
    const result = makeWindowless(fakeExe(3));
    expect(result.readUInt16LE(SUBSYSTEM_OFFSET)).toBe(2);
  });

  // The console binary stays installed as the CLI, so it must keep its console.
  it("leaves the source executable untouched", () => {
    const source = fakeExe(3);
    makeWindowless(source);
    expect(source.readUInt16LE(SUBSYSTEM_OFFSET)).toBe(3);
  });

  it("changes nothing but the subsystem field", () => {
    const source = fakeExe(3);
    const result = makeWindowless(source);
    result.writeUInt16LE(3, SUBSYSTEM_OFFSET);
    expect(result.equals(source)).toBe(true);
  });

  // Writing a corrupted plxmw.exe would silently break autostart.
  it.each([
    ["an empty buffer", Buffer.alloc(0)],
    ["a non-MZ file", Buffer.alloc(0x200)],
    [
      "an MZ file without a PE signature",
      (() => {
        const exe = fakeExe(3);
        exe.write("XX", PE_OFFSET, "latin1");
        return exe;
      })()
    ]
  ])("rejects %s", (_, input) => {
    expect(() => makeWindowless(input)).toThrow("Not a Windows executable");
  });
});
