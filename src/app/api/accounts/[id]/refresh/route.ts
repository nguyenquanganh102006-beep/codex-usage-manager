import { NextResponse } from "next/server";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { refreshAccount } from "@/lib/accounts/service";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { assertMutationSafety(request); const { id } = await params; return NextResponse.json({ account: await refreshAccount(id) }); } catch (error) { return jsonError(error, 500); } }
