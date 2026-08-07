import fs from "node:fs/promises";
import path from "node:path";
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
    const resolved = await fs.realpath(configured);
    if (process.platform === "win32" && path.basename(resolved).toLowerCase() !== "codex.exe") throw new Error("CODEX_CLI_PATH phải trỏ tới codex.exe");
    return resolved;
  }
  try {
    const result = await execFileAsync(process.platform === "win32" ? "where.exe" : "which", ["codex"]);
    const candidate = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (!candidate) throw new Error("Codex CLI not found");
    const resolved = await fs.realpath(candidate);
    if (process.platform === "win32" && path.basename(resolved).toLowerCase() !== "codex.exe") throw new Error("Codex CLI không phải codex.exe hợp lệ");
    return resolved;
  } catch {
    throw new Error("Không tìm thấy Codex CLI. Hãy cài Codex CLI hoặc cấu hình CODEX_CLI_PATH.");
  }
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

export async function readCodexData(codexHomeId: string) {
  const client = await openCodexClient(codexHomeId);
  try {
    const account = await client.request<CodexAccountResponse>("account/read", { refreshToken: true });
    if (!account.account || account.account.type !== "chatgpt") return { account, rateLimits: null, usage: null };
    const rateLimits = await client.request<CodexRateLimitsResponse>("account/rateLimits/read");
    let usage: CodexTokenUsageResponse | null = null;
    try { usage = await client.request<CodexTokenUsageResponse>("account/usage/read"); } catch { usage = null; }
    return { account, rateLimits, usage };
  } catch (error) {
    if (error instanceof JsonRpcError) throw new Error(sanitizeMessage(error.message));
    throw error;
  } finally { await client.close(); }
}
