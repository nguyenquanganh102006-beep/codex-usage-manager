/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { UsageStatus as PrismaUsageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountRoot } from "@/lib/data-root";
import { maskEmail, sanitizeMessage } from "@/lib/security";
import { fetchCodexUsage } from "@/lib/usage/provider";
import type { AccountView, CodexUsageSnapshot } from "@/lib/types";

function numberOrUndefined(value: bigint | number | null | undefined) {
  return value == null ? undefined : Number(value);
}

function snapshotView(snapshot: any): CodexUsageSnapshot | null {
  if (!snapshot) return null;
  return {
    accountId: snapshot.accountId,
    plan: snapshot.plan ?? undefined,
    windows: (snapshot.windows ?? []).map((window: any) => ({
      limitId: window.limitId, limitName: window.limitName ?? undefined, kind: window.kind.toLowerCase(),
      usedPercent: window.usedPercent, remainingPercent: window.remainingPercent,
      windowDurationMins: window.windowDurationMins ?? undefined,
      resetsAt: window.resetsAt?.toISOString(),
    })),
    tokenUsage: snapshot.tokenUsage ? {
      lifetimeTokens: numberOrUndefined(snapshot.tokenUsage.lifetimeTokens),
      peakDailyTokens: numberOrUndefined(snapshot.tokenUsage.peakDailyTokens),
      longestRunningTurnSec: snapshot.tokenUsage.longestRunningTurnSec ?? undefined,
      currentStreakDays: snapshot.tokenUsage.currentStreakDays ?? undefined,
      longestStreakDays: snapshot.tokenUsage.longestStreakDays ?? undefined,
    } : undefined,
    credits: snapshot.creditsBalance != null ? { balance: snapshot.creditsBalance, hasCredits: Boolean(snapshot.creditsHas), unlimited: Boolean(snapshot.creditsUnlimited) } : undefined,
    resetCreditsAvailable: snapshot.resetCreditsAvailable ?? undefined,
    rateLimitReachedType: snapshot.rateLimitReachedType ?? undefined,
    checkedAt: snapshot.checkedAt.toISOString(), source: snapshot.source.toLowerCase(), status: snapshot.status.toLowerCase(), message: snapshot.message ?? undefined,
  };
}

function accountView(account: any): AccountView {
  const latest = account.snapshots?.[0];
  const event = account.planEvents?.[0];
  return {
    id: account.id, displayName: account.displayName, maskedEmail: account.maskedEmail,
    status: account.status.toLowerCase(), plan: account.currentPlan,
    planExpiresAt: account.planExpiresAt?.toISOString() ?? null,
    resetCreditsExpiresAt: account.resetCreditsExpiresAt?.toISOString() ?? null,
    lastCheckedAt: account.lastCheckedAt?.toISOString() ?? null,
    lastSuccessAt: account.lastSuccessAt?.toISOString() ?? null,
    lastErrorMessage: account.lastErrorMessage,
    latestSnapshot: snapshotView(latest),
    planChanged: event ? { fromPlan: event.fromPlan, toPlan: event.toPlan, detectedAt: event.detectedAt.toISOString() } : null,
  };
}

const accountInclude = {
  snapshots: { orderBy: { checkedAt: "desc" as const }, take: 1, include: { windows: true, tokenUsage: true } },
  planEvents: { orderBy: { detectedAt: "desc" as const }, take: 1 },
};

export async function listAccounts() {
  const rows = await prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }], include: accountInclude });
  return rows.map(accountView);
}

export async function createAccount(displayName: string) {
  const row = await prisma.account.create({ data: { displayName: displayName.trim(), codexHomeId: crypto.randomUUID() }, include: accountInclude });
  return accountView(row);
}

export async function getAccount(id: string) {
  const row = await prisma.account.findUnique({ where: { id }, include: { ...accountInclude, snapshots: { orderBy: { checkedAt: "desc" }, take: 20, include: { windows: true, tokenUsage: true } } } });
  return row ? accountView(row) : null;
}

export async function refreshAccount(id: string, options: { weeklyOnly?: boolean } = {}) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) throw new Error("Account không tồn tại");
  const startedAt = new Date();
  let snapshot: CodexUsageSnapshot | undefined;
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { snapshot = await fetchCodexUsage(id, account.codexHomeId, options); lastError = undefined; break; }
      catch (error) {
        lastError = error;
        const message = String(error).toLowerCase();
        if (message.includes("401") || message.includes("403") || message.includes("login") || message.includes("unsupported")) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt + Math.floor(Math.random() * 150)));
      }
    }
    if (lastError) throw lastError;
    if (!snapshot) throw new Error("Không nhận được dữ liệu usage");
  }
  catch (error) { snapshot = { accountId: id, windows: [], checkedAt: new Date().toISOString(), source: "codex_app_server", status: "error", message: sanitizeMessage(error) }; }
  if (!snapshot) throw new Error("Không nhận được dữ liệu usage");
  const checkedAt = new Date(snapshot.checkedAt);
  const status = snapshot.status.toUpperCase() as PrismaUsageStatus;
  const accountStatus = ({ available: "ACTIVE", login_required: "LOGIN_REQUIRED", access_denied: "ACCESS_DENIED", unsupported: "UNSUPPORTED", error: "ERROR" } as const)[snapshot.status] ?? "ERROR";
  await prisma.$transaction(async (tx) => {
    const previous = account.currentPlan;
    await tx.usageSnapshot.create({ data: {
      accountId: id, source: snapshot.source === "manual" ? "MANUAL" : "CODEX_APP_SERVER", plan: snapshot.plan,
      status, checkedAt, rateLimitReachedType: snapshot.rateLimitReachedType, creditsBalance: snapshot.credits?.balance,
      creditsHas: snapshot.credits?.hasCredits, creditsUnlimited: snapshot.credits?.unlimited, resetCreditsAvailable: snapshot.resetCreditsAvailable, message: snapshot.message,
      windows: { create: snapshot.windows.map((window) => ({ limitId: window.limitId, limitName: window.limitName, kind: window.kind === "primary" ? "PRIMARY" : "SECONDARY", usedPercent: window.usedPercent, remainingPercent: window.remainingPercent, windowDurationMins: window.windowDurationMins, resetsAt: window.resetsAt ? new Date(window.resetsAt) : null })) },
      tokenUsage: snapshot.tokenUsage ? { create: { accountId: id, checkedAt, lifetimeTokens: snapshot.tokenUsage.lifetimeTokens == null ? undefined : BigInt(Math.round(snapshot.tokenUsage.lifetimeTokens)), peakDailyTokens: snapshot.tokenUsage.peakDailyTokens == null ? undefined : BigInt(Math.round(snapshot.tokenUsage.peakDailyTokens)), longestRunningTurnSec: snapshot.tokenUsage.longestRunningTurnSec, currentStreakDays: snapshot.tokenUsage.currentStreakDays, longestStreakDays: snapshot.tokenUsage.longestStreakDays } } : undefined,
    }});
    if (snapshot.tokenUsage?.dailyUsageBuckets) for (const bucket of snapshot.tokenUsage.dailyUsageBuckets) await tx.dailyTokenUsage.upsert({ where: { accountId_date: { accountId: id, date: new Date(bucket.startDate) } }, create: { accountId: id, date: new Date(bucket.startDate), tokens: BigInt(Math.round(bucket.tokens)) }, update: { tokens: BigInt(Math.round(bucket.tokens)) } });
    if (snapshot.plan && snapshot.plan !== previous) await tx.planEvent.create({ data: { accountId: id, fromPlan: previous, toPlan: snapshot.plan, detectedAt: checkedAt } });
    await tx.account.update({ where: { id }, data: { status: accountStatus, previousPlan: previous, currentPlan: snapshot.plan ?? previous, maskedEmail: snapshot.email ? maskEmail(snapshot.email) : account.maskedEmail, lastCheckedAt: checkedAt, lastSuccessAt: snapshot.status === "available" ? checkedAt : account.lastSuccessAt, lastErrorCode: snapshot.status === "available" ? null : snapshot.status, lastErrorMessage: snapshot.status === "available" ? null : snapshot.message } });
    await tx.checkAttempt.create({ data: { accountId: id, source: "CODEX_APP_SERVER", startedAt, finishedAt: new Date(), status, errorCode: snapshot.status === "available" ? null : snapshot.status, errorMessage: snapshot.message } });
  });
  return getAccount(id);
}

export async function updateAccountEmail(id: string, email?: string | null) {
  await prisma.account.update({ where: { id }, data: { maskedEmail: maskEmail(email) } });
  return getAccount(id);
}

export async function deleteAccount(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return false;
  await prisma.account.delete({ where: { id } });
  return true;
}

export async function history(id: string) {
  const rows = await prisma.usageSnapshot.findMany({ where: { accountId: id }, orderBy: { checkedAt: "desc" }, take: 50, include: { windows: true, tokenUsage: true } });
  return rows.map(snapshotView);
}

export async function getSettings() { return prisma.appSettings.upsert({ where: { id: 1 }, create: {}, update: {} }); }
export async function updateSettings(data: { theme?: string; sortKey?: string; autoRefreshEnabled?: boolean; autoRefreshMinutes?: number }) { return prisma.appSettings.upsert({ where: { id: 1 }, create: { ...data }, update: { ...data } }); }

export function accountPath(id: string) { return getAccountRoot(id); }
