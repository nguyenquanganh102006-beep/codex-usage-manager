import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getCodexHome } from "@/lib/data-root";
import { sanitizeMessage } from "@/lib/security";
import { CodexRpcClient, JsonRpcError } from "@/lib/codex/json-rpc";

const execFileAsync = promisify(execFile);

export interface CodexAccountResponse {
  account?: { type?: string; email?: string | null; planType?: string | null } | null;
  requiresOpenaiAuth?: boolean;
}

export interface CodexRateLimitsResponse {
  rateLimits?: RateLimitSnapshot | null;
  rateLimitsByLimitId?: Record<string, RateLimitSnapshot> | null;
  rateLimitResetCredits?: { availableCount?: number } | null;
}

interface RateLimitSnapshot {
  limitId?: string | null;
  limitName?: string | null;
  planType?: string | null;
  primary?: RateLimitWindow | null;
  secondary?: RateLimitWindow | null;
  rateLimitReachedType?: string | null;
  credits?: { balance?: string | null; hasCredits: boolean; unlimited: boolean } | null;
}

interface RateLimitWindow { usedPercent?: number; windowDurationMins?: number | null; resetsAt?: number | null }

export interface CodexTokenUsageResponse {
  summary?: { lifetimeTokens?: number; peakDailyTokens?: number; longestRunningTurnSec?: number; currentStreakDays?: number; longestStreakDays?: number } | null;
  dailyUsageBuckets?: Array<{ startDate: string; tokens: number }> | null;
}

const pendingLogins = new Map<string, { client: CodexRpcClient; loginId: string; done: boolean; success?: boolean; error?: string }>();

export async function ensureCodexHome(codexHomeId: string) {
  const home = getCodexHome(codexHomeId);
  await fs.mkdir(home, { recursive: true });
  const configPath = path.join(home, "config.toml");
  try { await fs.access(configPath); } catch {
    await fs.writeFile(configPath, 'forced_login_method = "chatgpt"\ncli_auth_credentials_store = "file"\n[analytics]\nenabled = false\n', { encoding: "utf8", flag: "wx" });
  }
  return home;
}

export async function findCodexExecutable() {
  const configured = process.env.CODEX_CLI_PATH;
  if (configured) {
    try {
      const resolved = await fs.realpath(configured);
      if (process.platform === "win32" && path.basename(resolved).toLowerCase() !== "codex.exe") throw new Error("CODEX_CLI_PATH phải trỏ tới codex.exe");
      return resolved;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  try {
    const result = await execFileAsync(process.platform === "win32" ? "where.exe" : "which", ["codex"]);
    const candidate = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (!candidate) throw new Error("Codex CLI not found");
    const resolved = await fs.realpath(candidate);
    if (process.platform === "win32" && path.basename(resolved).toLowerCase() !== "codex.exe") throw new Error("Codex CLI không phải codex.exe hợp lệ");
    return resolved;
  } catch { /* Thử các thư mục extension VS Code đã biết ở dưới. */ }

  if (process.platform === "win32") {
    const extensionRoots = [path.join(os.homedir(), ".vscode", "extensions"), path.join(os.homedir(), ".vscode-insiders", "extensions")];
    const candidates: Array<{ file: string; modifiedAt: number }> = [];
    for (const root of extensionRoots) {
      const entries = await fs.readdir(/*turbopackIgnore: true*/ root, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("openai.chatgpt-")) continue;
        const file = path.join(root, entry.name, "bin", "windows-x86_64", "codex.exe");
        try {
          const stat = await fs.stat(file);
          if (stat.isFile()) candidates.push({ file, modifiedAt: stat.mtimeMs });
        } catch { /* Bỏ qua phiên bản extension đang cài dở hoặc đã bị xóa. */ }
      }
    }
    candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
    if (candidates[0]) return fs.realpath(candidates[0].file);
  }

  const configuredHint = configured ? " CODEX_CLI_PATH hiện tại không còn tồn tại; hãy xóa biến này để ứng dụng tự dò lại." : "";
  throw new Error(`Không tìm thấy Codex CLI. Hãy cài Codex CLI hoặc cấu hình CODEX_CLI_PATH.${configuredHint}`);
}

export async function openCodexClient(codexHomeId: string) {
  const command = await findCodexExecutable();
  const home = await ensureCodexHome(codexHomeId);
  const client = new CodexRpcClient(command, home);
  await client.initialize();
  return client;
}

export async function startLogin(accountId: string, codexHomeId: string) {
  if (pendingLogins.has(accountId)) throw new Error("Tài khoản đang có phiên đăng nhập chờ xử lý.");
  const client = await openCodexClient(codexHomeId);
  const result = await client.request<{ type: string; loginId: string; authUrl: string }>("account/login/start", { type: "chatgpt", appBrand: "codex", useHostedLoginSuccessPage: true });
  const entry = { client, loginId: result.loginId, done: false, success: undefined as boolean | undefined, error: undefined as string | undefined };
  client.onNotification((notification) => {
    if (notification.method !== "account/login/completed") return;
    const params = notification.params as { loginId?: string; success?: boolean; error?: string | null };
    if (params.loginId !== result.loginId) return;
    entry.done = true; entry.success = params.success; entry.error = params.error ?? undefined;
  });
  pendingLogins.set(accountId, entry);
  return { loginId: result.loginId, authUrl: result.authUrl };
}

export async function loginStatus(accountId: string) {
  const entry = pendingLogins.get(accountId);
  if (!entry) return null;
  if (entry.done) { await entry.client.close(); pendingLogins.delete(accountId); }
  return { done: entry.done, success: entry.success, error: entry.error };
}

export async function logoutAccount(codexHomeId: string) {
  const client = await openCodexClient(codexHomeId);
  try { await client.request("account/logout"); } finally { await client.close(); }
}

export async function readCodexData(codexHomeId: string, options: { includeUsage?: boolean } = {}) {
  const client = await openCodexClient(codexHomeId);
  try {
    const account = await client.request<CodexAccountResponse>("account/read", { refreshToken: true });
    if (!account.account || account.account.type !== "chatgpt") return { account, rateLimits: null, usage: null };
    const rateLimits = await client.request<CodexRateLimitsResponse>("account/rateLimits/read");
    let usage: CodexTokenUsageResponse | null = null;
    if (options.includeUsage !== false) {
      try { usage = await client.request<CodexTokenUsageResponse>("account/usage/read"); } catch { usage = null; }
    }
    return { account, rateLimits, usage };
  } catch (error) {
    if (error instanceof JsonRpcError) throw new Error(sanitizeMessage(error.message));
    throw error;
  } finally { await client.close(); }
}
