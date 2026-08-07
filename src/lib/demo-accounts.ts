import type { AccountView } from "@/lib/types";

function futureIso(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function createDemoAccounts(): AccountView[] {
  const checkedAt = new Date().toISOString();

  return [
    {
      id: "demo-anh",
      displayName: "Nguyễn Quang Anh",
      maskedEmail: "ng***@gmail.com",
      status: "active",
      plan: "plus",
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      latestSnapshot: {
        accountId: "demo-anh",
        plan: "plus",
        status: "available",
        source: "codex_app_server",
        checkedAt,
        windows: [
          { limitId: "codex", limitName: "Codex", kind: "primary", usedPercent: 32, remainingPercent: 68, windowDurationMins: 300, resetsAt: futureIso(192) },
          { limitId: "codex", limitName: "Codex", kind: "secondary", usedPercent: 18, remainingPercent: 82, windowDurationMins: 10_080, resetsAt: futureIso(6_840) },
        ],
      },
    },
    {
      id: "demo-work",
      displayName: "Tài khoản công việc",
      maskedEmail: "wo***@company.dev",
      status: "active",
      plan: "pro",
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      latestSnapshot: {
        accountId: "demo-work",
        plan: "pro",
        status: "available",
        source: "codex_app_server",
        checkedAt,
        windows: [
          { limitId: "codex", limitName: "Codex", kind: "primary", usedPercent: 76, remainingPercent: 24, windowDurationMins: 300, resetsAt: futureIso(74) },
          { limitId: "codex", limitName: "Codex", kind: "secondary", usedPercent: 47, remainingPercent: 53, windowDurationMins: 10_080, resetsAt: futureIso(3_420) },
        ],
      },
    },
    {
      id: "demo-personal",
      displayName: "Tài khoản cá nhân",
      maskedEmail: "pe***@outlook.com",
      status: "active",
      plan: "plus",
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      latestSnapshot: {
        accountId: "demo-personal",
        plan: "plus",
        status: "available",
        source: "codex_app_server",
        checkedAt,
        windows: [
          { limitId: "codex", limitName: "Codex", kind: "primary", usedPercent: 91, remainingPercent: 9, windowDurationMins: 300, resetsAt: futureIso(28) },
          { limitId: "codex", limitName: "Codex", kind: "secondary", usedPercent: 63, remainingPercent: 37, windowDurationMins: 10_080, resetsAt: futureIso(1_880) },
        ],
      },
    },
  ];
}
