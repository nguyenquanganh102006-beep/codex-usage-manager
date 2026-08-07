import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const dataRoot = process.env.CODEX_USAGE_DATA_DIR ?? path.join(process.env.LOCALAPPDATA ?? ".", "CodexUsageManager");
export default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" }, datasource: { url: process.env.DATABASE_URL ?? `file:${path.join(dataRoot, "manager.db").replaceAll("\\", "/")}` } });
