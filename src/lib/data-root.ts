import path from "node:path";
import os from "node:os";

export function getDataRoot() {
  return process.env.CODEX_USAGE_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), "CodexUsageManager");
}

export function getAccountRoot(codexHomeId: string) {
  return path.join(getDataRoot(), "accounts", codexHomeId);
}

export function getCodexHome(codexHomeId: string) {
  return path.join(getAccountRoot(codexHomeId), "codex-home");
}

export function getLogRoot() {
  return path.join(getDataRoot(), "logs");
}

