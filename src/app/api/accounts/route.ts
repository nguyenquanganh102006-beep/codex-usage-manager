import { NextResponse } from "next/server";
import { z } from "zod";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { createAccount, listAccounts } from "@/lib/accounts/service";
export async function GET() { try { return NextResponse.json({ accounts: await listAccounts() }); } catch (error) { return jsonError(error, 500); } }
export async function POST(request: Request) { try { assertMutationSafety(request); const body = z.object({ displayName: z.string().trim().min(1).max(80) }).parse(await request.json()); return NextResponse.json({ account: await createAccount(body.displayName) }, { status: 201 }); } catch (error) { return jsonError(error); } }
