import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { prisma } from "@/lib/prisma";
import { getAccountRoot } from "@/lib/data-root";
import { logoutAccount } from "@/lib/codex/bridge";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { try { assertMutationSafety(request); const { id } = await params; const account = await prisma.account.findUnique({ where: { id } }); if (!account) return jsonError(new Error("Không tìm thấy tài khoản"), 404); await logoutAccount(account.codexHomeId).catch(() => undefined); await prisma.account.delete({ where: { id } }); await fs.rm(getAccountRoot(account.codexHomeId), { recursive: true, force: true }); return NextResponse.json({ ok: true }); } catch (error) { return jsonError(error, 500); } }
