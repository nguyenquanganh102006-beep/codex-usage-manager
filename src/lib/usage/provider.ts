import { readCodexData } from "@/lib/codex/bridge";
import type { CodexUsageSnapshot, UsageWindow } from "@/lib/types";

function toIso(seconds?: number | null) { return seconds ? new Date(seconds * 1000).toISOString() : undefined; }

export async function fetchCodexUsage(accountId: string, codexHomeId: string): Promise<CodexUsageSnapshot> {
  const checkedAt = new Date().toISOString();
  try {
    const data = await readCodexData(codexHomeId);
    if (!data.account.account || data.account.account.type !== "chatgpt") {
      return { accountId, windows: [], checkedAt, source: "codex_app_server", status: "login_required", message: "Chưa đăng nhập Codex bằng ChatGPT." };
    }
    const rate = data.rateLimits;
    const buckets = rate?.rateLimitsByLimitId ?? (rate?.rateLimits ? { [rate.rateLimits.limitId ?? "codex"]: rate.rateLimits } : {});
    const windows: UsageWindow[] = [];
    let reached: string | undefined;
    let credits: CodexUsageSnapshot["credits"] | undefined;
    for (const [fallbackId, bucket] of Object.entries(buckets)) {
      const limitId = bucket.limitId ?? fallbackId;
      reached ||= bucket.rateLimitReachedType ?? undefined;
      credits ||= bucket.credits ? { balance: bucket.credits.balance ?? undefined, hasCredits: bucket.credits.hasCredits, unlimited: bucket.credits.unlimited } : undefined;
      for (const kind of ["primary", "secondary"] as const) {
        const window = bucket[kind];
        if (!window) continue;
        const used = Math.max(0, Math.min(100, Number(window.usedPercent ?? 0)));
        windows.push({ limitId, limitName: bucket.limitName ?? undefined, kind, usedPercent: used, remainingPercent: 100 - used, windowDurationMins: window.windowDurationMins ?? undefined, resetsAt: toIso(window.resetsAt) });
      }
    }
    const summary = data.usage?.summary;
    return {
      accountId, email: data.account.account.email ?? null, plan: data.account.account.planType ?? undefined, windows,
      tokenUsage: data.usage ? { ...summary, dailyUsageBuckets: data.usage.dailyUsageBuckets ?? undefined } : undefined,
      credits, resetCreditsAvailable: rate?.rateLimitResetCredits?.availableCount,
      rateLimitReachedType: reached, checkedAt, source: "codex_app_server", status: "available",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    const status = lower.includes("401") || lower.includes("unauthorized") || lower.includes("login") ? "login_required" : lower.includes("403") || lower.includes("forbidden") ? "access_denied" : lower.includes("not found") || lower.includes("codex cli") ? "unsupported" : "error";
    return { accountId, windows: [], checkedAt, source: "codex_app_server", status, message };
  }
}
