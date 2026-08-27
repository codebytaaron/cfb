import { NextRequest, NextResponse } from "next/server";
import { dailyBriefing } from "@/lib/analyst";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const fav = (req.nextUrl.searchParams.get("favorites") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    return NextResponse.json(await dailyBriefing(fav));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
