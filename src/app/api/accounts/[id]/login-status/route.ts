import { NextResponse } from "next/server";
import { loginStatus } from "@/lib/codex/bridge";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return NextResponse.json(await loginStatus(id) ?? { done: false }); } catch { return NextResponse.json({ error: "Không thể đọc trạng thái đăng nhập" }, { status: 500 }); } }
