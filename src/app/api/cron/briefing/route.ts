import { NextRequest, NextResponse } from "next/server";
import { dailyBriefing } from "@/lib/analyst";
import { recordEvent } from "@/lib/store";

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const h = req.headers.get("authorization");
    if (h !== `Bearer ${secret}` && req.nextUrl.searchParams.get("key") !== secret)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const b = await dailyBriefing([]);
    await recordEvent({
      kind: "briefing",
      importance: "MEDIUM",
      headline: b.headline ?? "Daily briefing published",
      body: b.outlook ?? "",
      data: { date: b.date },
    });
    return NextResponse.json({ ok: true, headline: b.headline });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
