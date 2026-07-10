import { NextRequest, NextResponse } from "next/server";
import { pollMeetings } from "@/lib/agent/pollMeetings";

// Hit by Vercel Cron every 2 minutes (see vercel.json) — Vercel attaches
// `Authorization: Bearer ${CRON_SECRET}` automatically when the env var is
// set, matching the check below. Also triggered on-demand by
// checkMeetingsNow() when the AI Agent page loads (see lib/actions/agent.ts).
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
