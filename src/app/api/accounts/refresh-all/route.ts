import { NextResponse } from "next/server";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { listAccounts, refreshAccount } from "@/lib/accounts/service";

export async function POST(request: Request) {
  try {
    assertMutationSafety(request);
    const accounts = await listAccounts();
    const results: Array<{ accountId: string; success: boolean }> = [];

    for (const [index, account] of accounts.entries()) {
      try {
        const refreshed = await refreshAccount(account.id, { weeklyOnly: true });
        results.push({ accountId: account.id, success: refreshed?.latestSnapshot?.status === "available" });
      } catch {
        results.push({ accountId: account.id, success: false });
      }
      if (index < accounts.length - 1) await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      accounts: results,
      total: results.length,
      succeeded: results.filter((result) => result.success).length,
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
