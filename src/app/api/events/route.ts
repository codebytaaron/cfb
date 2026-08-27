import { NextRequest, NextResponse } from "next/server";
import { recentEvents } from "@/lib/store";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  return NextResponse.json({ events: await recentEvents(limit) });
}
