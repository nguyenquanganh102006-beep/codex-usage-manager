import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const fallbackDataRoot = process.env.CODEX_USAGE_DATA_DIR ?? path.join(process.env.LOCALAPPDATA ?? ".", "CodexUsageManager");
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(fallbackDataRoot, "manager.db").replaceAll("\\\\", "/")}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL.replace(/^file:/, "") }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
