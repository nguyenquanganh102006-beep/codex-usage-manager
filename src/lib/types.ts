export type UsageSource = "codex_app_server" | "manual";

export type UsageStatus =
  | "available"
  | "unsupported"
  | "login_required"
  | "access_denied"
  | "error";

export type AccountStatus =
  | "new"
  | "active"
  | "login_required"
  | "access_denied"
  | "unsupported"
  | "error";

export interface UsageWindow {
  limitId: string;
  limitName?: string;
  kind: "primary" | "secondary";
  usedPercent: number;
  remainingPercent: number;
  windowDurationMins?: number;
  resetsAt?: string;
}

export interface CodexUsageSnapshot {
  accountId: string;
  email?: string | null;
  plan?: string;
  windows: UsageWindow[];
  tokenUsage?: {
    lifetimeTokens?: number;
    peakDailyTokens?: number;
    longestRunningTurnSec?: number;
    currentStreakDays?: number;
    longestStreakDays?: number;
    dailyUsageBuckets?: Array<{ startDate: string; tokens: number }>;
  };
  credits?: { balance?: string; hasCredits: boolean; unlimited: boolean };
  resetCreditsAvailable?: number;
  rateLimitReachedType?: string;
  checkedAt: string;
  source: UsageSource;
  status: UsageStatus;
  message?: string;
}

export interface AccountView {
  id: string;
  displayName: string;
  maskedEmail?: string | null;
  status: AccountStatus;
  plan?: string | null;
  planExpiresAt?: string | null;
  resetCreditsExpiresAt?: string | null;
  lastCheckedAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorMessage?: string | null;
  latestSnapshot?: CodexUsageSnapshot | null;
  planChanged?: { fromPlan?: string | null; toPlan?: string | null; detectedAt: string } | null;
}
