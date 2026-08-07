import { NextResponse } from "next/server";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { listAccounts, refreshAccount } from "@/lib/accounts/service";
export async function POST(request: Request) { try { assertMutationSafety(request); const accounts = await listAccounts(); const results: unknown[] = []; for (let i = 0; i < accounts.length; i += 2) results.push(...await Promise.all(accounts.slice(i, i + 2).map((account) => refreshAccount(account.id)))); return NextResponse.json({ accounts: results }); } catch (error) { return jsonError(error, 500); } }
