import { NextResponse } from "next/server";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { prisma } from "@/lib/prisma";
import { logoutAccount } from "@/lib/codex/bridge";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { assertMutationSafety(request); const { id } = await params; const account = await prisma.account.findUnique({ where: { id } }); if (!account) return jsonError(new Error("Không tìm thấy tài khoản"), 404); await logoutAccount(account.codexHomeId); await prisma.account.update({ where: { id }, data: { status: "LOGIN_REQUIRED" } }); return NextResponse.json({ ok: true }); } catch (error) { return jsonError(error, 500); } }
