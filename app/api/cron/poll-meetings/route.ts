import { NextRequest, NextResponse } from "next/server";
import { pollMeetings } from "@/lib/agent/pollMeetings";

// Hit by Vercel Cron once daily at 03:00 UTC (see vercel.json) — a distant
// backstop for meetings nobody ever revisits the AI Agent page for. Vercel's
// Hobby plan caps cron jobs at once per day, so this can't be the primary
// mechanism; while the page is open, AutoPollTrigger polls checkMeetingsNow()
// every 5 seconds instead (see lib/actions/agent.ts), which is what actually
// catches a transcript promptly. Vercel attaches
// `Authorization: Bearer ${CRON_SECRET}` automatically when the env var is
// set, matching the check below.
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await pollMeetings();
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
