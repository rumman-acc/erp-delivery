"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkMeetingsNow } from "@/lib/actions/agent";

const POLL_INTERVAL_MS = 5_000;

function secondsAgoLabel(lastCheckedAt: number, nowTick: number): string {
  const seconds = Math.max(0, Math.round((nowTick - lastCheckedAt) / 1000));
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

// Keeps checking every linked, ended meeting (across every project the
// caller can edit) for a transcript every 5 seconds for as long as the AI
// Agent page stays open AND there's actually something worth checking
// (hasPendingMeetings). This is the real delivery mechanism, not just a
// nicety — Vercel's Hobby plan caps cron jobs at once/day, so the scheduled
// cron (vercel.json) can only ever be a backstop for tabs nobody reopens,
// never a near-real-time path.
//
// hasPendingMeetings comes from the server (linkedMeetings in
// app/(app)/agent/page.tsx) and is recomputed on every router.refresh()
// this component triggers — once every linked meeting resolves to
// fetched/unavailable/error, it flips false and this stops polling on its
// own instead of running forever against an empty result set.
//
// Gated on `canEdit` because checkMeetingsNow() requires edit access on at
// least one project; a view-only user polling every 5s would just generate
// a "Forbidden" error each tick for nothing.
export function AutoPollTrigger({
  canEdit,
  hasPendingMeetings,
}: {
  canEdit: boolean;
  hasPendingMeetings: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!canEdit || !hasPendingMeetings) return;
    let cancelled = false;

    async function poll() {
      if (inFlight.current) return; // previous check still running — skip this tick rather than pile up
      inFlight.current = true;
      setChecking(true);
      try {
        await checkMeetingsNow();
        if (!cancelled) router.refresh();
      } catch (err) {
        console.error("checkMeetingsNow failed:", err);
      } finally {
        inFlight.current = false;
        if (!cancelled) {
          setChecking(false);
          setLastCheckedAt(Date.now());
        }
      }
    }

    poll();
    const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    const tickTimer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      clearInterval(tickTimer);
    };
  }, [canEdit, hasPendingMeetings, router]);

  if (!canEdit || !hasPendingMeetings) return null;

  return (
    <div
      className="text-sm text-muted"
      style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}
      role="status"
    >
      {checking ? (
        <>
          <i className="fa fa-spinner fa-spin" /> Checking for new transcripts…
        </>
      ) : (
        <>
          <span className="agent-pulse-dot" />
          AI Agent is watching for new transcripts{lastCheckedAt && nowTick ? ` · checked ${secondsAgoLabel(lastCheckedAt, nowTick)}` : ""}
        </>
      )}
    </div>
  );
}
