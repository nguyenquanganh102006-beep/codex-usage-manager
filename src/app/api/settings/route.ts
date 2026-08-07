import { NextResponse } from "next/server";
import { z } from "zod";
import { assertMutationSafety, jsonError } from "@/lib/api-safety";
import { getSettings, updateSettings } from "@/lib/accounts/service";
export async function GET() { return NextResponse.json({ settings: await getSettings() }); }
export async function PATCH(request: Request) { try { assertMutationSafety(request); const body = z.object({ theme: z.enum(["light", "dark", "system"]).optional(), sortKey: z.string().max(30).optional() }).parse(await request.json()); return NextResponse.json({ settings: await updateSettings(body) }); } catch (error) { return jsonError(error); } }
