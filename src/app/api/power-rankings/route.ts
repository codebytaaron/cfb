import { NextRequest, NextResponse } from "next/server";
import { explainedPowerRankings } from "@/lib/analyst";
import { seasonContext } from "@/lib/season";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const y = req.nextUrl.searchParams.get("year");
  const year = y ? Number(y) : (await seasonContext()).year;
  try {
    const data = await explainedPowerRankings(year);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
