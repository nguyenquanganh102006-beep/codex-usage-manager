import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/codex/bridge", () => ({ readCodexData: vi.fn() }));
import { readCodexData } from "@/lib/codex/bridge";
import { fetchCodexUsage } from "@/lib/usage/provider";

describe("Codex usage normalization", () => {
  it("normalizes multi-bucket windows and clamps percent", async () => {
    vi.mocked(readCodexData).mockResolvedValue({ account: { account: { type: "chatgpt", planType: "plus", email: "person@example.com" } }, rateLimits: { rateLimitsByLimitId: { five: { limitId: "five", primary: { usedPercent: 120, windowDurationMins: 300, resetsAt: 1 } } } }, usage: null });
    const result = await fetchCodexUsage("a", "h");
    expect(result.status).toBe("available");
    expect(result.windows[0]).toMatchObject({ limitId: "five", usedPercent: 100, remainingPercent: 0 });
    expect(result.email).toBe("person@example.com");
  });
});
