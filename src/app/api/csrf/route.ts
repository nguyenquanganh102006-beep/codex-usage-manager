import { NextResponse } from "next/server";
import { csrfToken, setCsrf } from "@/lib/api-safety";
export function GET() { return setCsrf(NextResponse.json({ ok: true }), csrfToken()); }
