import { describe, expect, it } from "vitest";
import { maskEmail, sanitizeMessage } from "@/lib/security";

describe("security helpers", () => {
  it("masks email without retaining the local part", () => {
    expect(maskEmail("Alice.Example@example.com")).toBe("al***@example.com");
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });
  it("redacts credential-like values", () => {
    const value = sanitizeMessage("Bearer abcdefghijklmnop cookie: secret sk-test_123456789012");
    expect(value).not.toContain("abcdefghijklmnop");
    expect(value).not.toContain("secret");
    expect(value).not.toContain("sk-test_123456789012");
  });
});
