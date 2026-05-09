import { execFileSync } from "node:child_process";
import ytDlpExec from "yt-dlp-exec";

/**
 * Returns a yt-dlp-exec caller that uses the system-installed yt-dlp binary
 * (installed via pip — always the latest version) when available, falling back
 * to the npm-bundled binary otherwise.
 */
function resolveYtDlp() {
  // Check for system-installed yt-dlp (from pip)
  try {
    const version = execFileSync("yt-dlp", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    }).trim();
    console.log(`🔧 Using system yt-dlp binary (version ${version})`);
    return (ytDlpExec as any).create("yt-dlp") as typeof ytDlpExec;
  } catch {
    // Not available on system PATH
  }

  console.log("🔧 System yt-dlp not found; using npm-bundled binary");
  return ytDlpExec;
}

/** yt-dlp-exec caller that prefers the system binary over the npm-bundled one. */
export const ytDlp = resolveYtDlp();
