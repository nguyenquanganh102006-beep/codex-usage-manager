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

  it("only keeps the longest quota window and skips token usage for weekly refresh", async () => {
    vi.mocked(readCodexData).mockResolvedValue({
      account: { account: { type: "chatgpt", planType: "plus" } },
      rateLimits: {
        rateLimitsByLimitId: {
          codex: {
            limitId: "codex",
            primary: { usedPercent: 30, windowDurationMins: 300, resetsAt: 1 },
            secondary: { usedPercent: 55, windowDurationMins: 10_080, resetsAt: 2 },
          },
        },
      },
      usage: null,
    });

    const result = await fetchCodexUsage("a", "h", { weeklyOnly: true });

    expect(readCodexData).toHaveBeenLastCalledWith("h", { includeUsage: false });
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toMatchObject({ kind: "secondary", windowDurationMins: 10_080, remainingPercent: 45 });
    expect(result.tokenUsage).toBeUndefined();
  });

  it("keeps both 5-hour and weekly windows for a full refresh", async () => {
    vi.mocked(readCodexData).mockResolvedValue({
      account: { account: { type: "chatgpt", planType: "plus" } },
      rateLimits: {
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 1 },
          secondary: { usedPercent: 40, windowDurationMins: 10_080, resetsAt: 2 },
        },
      },
      usage: null,
    });

    const result = await fetchCodexUsage("a", "h");

    expect(result.windows).toHaveLength(2);
    expect(result.windows.map((window) => window.windowDurationMins)).toEqual([300, 10_080]);
  });

  it("maps an invalid ChatGPT token to login_required without exposing the endpoint", async () => {
    vi.mocked(readCodexData).mockRejectedValue(new Error("failed to fetch codex rate limits: 401 Unauthorized; Could not parse your authentication token"));

    const result = await fetchCodexUsage("a", "h");

    expect(result.status).toBe("login_required");
    expect(result.message).toContain("Đăng nhập lại");
    expect(result.message).not.toContain("backend-api");
  });
});
