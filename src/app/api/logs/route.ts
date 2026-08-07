import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getLogRoot } from "@/lib/data-root";
export async function GET() { try { const files = (await fs.readdir(getLogRoot()).catch(() => [])).filter((name) => name.endsWith(".log")).slice(-5); const logs = (await Promise.all(files.map(async (name) => ({ name, content: (await fs.readFile(path.join(getLogRoot(), name), "utf8")).slice(-10000) })))); return NextResponse.json({ logs }); } catch { return NextResponse.json({ logs: [] }); } }
