import { NextResponse } from "next/server";
import { history } from "@/lib/accounts/service";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return NextResponse.json({ snapshots: await history(id) }); } catch { return NextResponse.json({ error: "Không thể đọc lịch sử" }, { status: 500 }); } }
