import { NextRequest, NextResponse } from "next/server";
import { pollMeetings } from "@/lib/agent/pollMeetings";

// Hit by Vercel Cron every minute (see vercel.json) — the backstop for when
// nobody has the AI Agent page open. Vercel attaches
// `Authorization: Bearer ${CRON_SECRET}` automatically when the env var is
// set, matching the check below. While the page is open, AutoPollTrigger
// polls checkMeetingsNow() every 20 seconds instead (see lib/actions/agent.ts).
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
