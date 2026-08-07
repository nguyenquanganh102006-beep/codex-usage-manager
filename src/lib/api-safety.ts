import crypto from "node:crypto";
import { NextResponse } from "next/server";

const cookieName = "codex_csrf";

export function csrfToken() { return crypto.randomBytes(24).toString("hex"); }

export function setCsrf(response: NextResponse, token: string) {
  response.cookies.set(cookieName, token, { httpOnly: false, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}

export function assertMutationSafety(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) throw new Error("Origin không hợp lệ");
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)codex_csrf=([^;]+)/)?.[1];
  const header = request.headers.get("x-csrf-token");
  if (cookie && header && cookie !== header) throw new Error("CSRF token không hợp lệ");
}

export function jsonError(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Yêu cầu không hợp lệ" }, { status });
}
