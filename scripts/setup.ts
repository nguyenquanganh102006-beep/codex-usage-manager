import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { getDataRoot, getLogRoot } from "../src/lib/data-root";

const projectRoot = process.cwd();
const dataRoot = getDataRoot();
const dbPath = path.join(dataRoot, "manager.db");

async function main() {
  await fs.mkdir(path.join(dataRoot, "accounts"), { recursive: true });
  await fs.mkdir(getLogRoot(), { recursive: true });
  const databaseUrl = `file:${dbPath.replaceAll("\\", "/")}`;
  const envPath = path.join(projectRoot, ".env");
  const current = await fs.readFile(envPath, "utf8").catch(() => "");
  if (!current.match(/^DATABASE_URL=/m)) {
    await fs.writeFile(envPath, `${current.trim()}${current.trim() ? "\n" : ""}DATABASE_URL=${databaseUrl}\n`, "utf8");
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const run = (args: string[]) => {
    const cli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: projectRoot, env, stdio: "inherit", shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Prisma command failed: ${args.join(" ")}`);
  };
  run(["generate"]);
  const db = new Database(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS Account (id TEXT PRIMARY KEY NOT NULL, displayName TEXT NOT NULL, maskedEmail TEXT, codexHomeId TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'NEW', currentPlan TEXT, previousPlan TEXT, lastPlanChangeAt DATETIME, lastCheckedAt DATETIME, lastSuccessAt DATETIME, lastErrorCode TEXT, lastErrorMessage TEXT, sortOrder INTEGER NOT NULL DEFAULT 0, color TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS UsageSnapshot (id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, source TEXT NOT NULL, plan TEXT, status TEXT NOT NULL, checkedAt DATETIME NOT NULL, rateLimitReachedType TEXT, creditsBalance TEXT, creditsHas INTEGER, creditsUnlimited INTEGER, resetCreditsAvailable INTEGER, message TEXT, FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS UsageWindow (id TEXT PRIMARY KEY NOT NULL, snapshotId TEXT NOT NULL, limitId TEXT NOT NULL, limitName TEXT, kind TEXT NOT NULL, usedPercent INTEGER NOT NULL, remainingPercent INTEGER NOT NULL, windowDurationMins INTEGER, resetsAt DATETIME, FOREIGN KEY(snapshotId) REFERENCES UsageSnapshot(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS TokenUsageSnapshot (id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, snapshotId TEXT UNIQUE, checkedAt DATETIME NOT NULL, lifetimeTokens BIGINT, peakDailyTokens BIGINT, longestRunningTurnSec INTEGER, currentStreakDays INTEGER, longestStreakDays INTEGER, FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE, FOREIGN KEY(snapshotId) REFERENCES UsageSnapshot(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS DailyTokenUsage (id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, date DATETIME NOT NULL, tokens BIGINT NOT NULL, FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE, UNIQUE(accountId,date));
    CREATE TABLE IF NOT EXISTS PlanEvent (id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, fromPlan TEXT, toPlan TEXT, detectedAt DATETIME NOT NULL, FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS CheckAttempt (id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, source TEXT NOT NULL, startedAt DATETIME NOT NULL, finishedAt DATETIME, status TEXT NOT NULL, retryCount INTEGER NOT NULL DEFAULT 0, errorCode TEXT, errorMessage TEXT, FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS AppSettings (id INTEGER PRIMARY KEY NOT NULL DEFAULT 1, theme TEXT NOT NULL DEFAULT 'system', sortKey TEXT NOT NULL DEFAULT 'displayName', autoRefreshEnabled INTEGER NOT NULL DEFAULT 0, autoRefreshMinutes INTEGER NOT NULL DEFAULT 15, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS UsageSnapshot_account_checked ON UsageSnapshot(accountId, checkedAt);
    CREATE INDEX IF NOT EXISTS UsageWindow_snapshot_limit ON UsageWindow(snapshotId, limitId, kind);
    CREATE INDEX IF NOT EXISTS TokenUsage_account_checked ON TokenUsageSnapshot(accountId, checkedAt);
    CREATE INDEX IF NOT EXISTS DailyToken_account_date ON DailyTokenUsage(accountId, date);
    CREATE INDEX IF NOT EXISTS PlanEvent_account_detected ON PlanEvent(accountId, detectedAt);
    CREATE INDEX IF NOT EXISTS CheckAttempt_account_started ON CheckAttempt(accountId, startedAt);`);
  const accountColumns = db.prepare("PRAGMA table_info(Account)").all() as Array<{ name: string }>;
  const accountColumnNames = new Set(accountColumns.map((column) => column.name));
  if (!accountColumnNames.has("planExpiresAt")) db.exec("ALTER TABLE Account ADD COLUMN planExpiresAt DATETIME");
  if (!accountColumnNames.has("resetCreditsExpiresAt")) db.exec("ALTER TABLE Account ADD COLUMN resetCreditsExpiresAt DATETIME");
  db.close();

  const codex = process.env.CODEX_CLI_PATH ?? "codex";
  const probe = spawnSync(codex, ["--version"], { env, shell: false, encoding: "utf8" });
  if (probe.status === 0) console.log(`Codex CLI: ${(probe.stdout ?? "").trim()}`);
  else console.warn("Không tìm thấy Codex CLI trong PATH. Có thể đặt CODEX_CLI_PATH trong .env.");
  console.log(`Dữ liệu runtime: ${dataRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
