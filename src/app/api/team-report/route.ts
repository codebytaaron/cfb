import { NextRequest, NextResponse } from "next/server";
import { teamReport } from "@/lib/analyst";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get("team");
  if (!team) return NextResponse.json({ error: "team required" }, { status: 400 });
  try {
    return NextResponse.json(await teamReport(team));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
