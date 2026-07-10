"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkMeetingsNow } from "@/lib/actions/agent";

// Fires once when the AI Agent page mounts — checks this project's linked,
// ended meetings for a transcript immediately, instead of making the admin
// wait for the next scheduled cron tick (vercel.json runs it every 2 minutes
// regardless). Non-blocking: the page has already rendered by the time this
// runs, and router.refresh() re-pulls server data once the check completes.
export function AutoPollTrigger({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    checkMeetingsNow(projectId)
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch((err) => {
        console.error("checkMeetingsNow failed:", err);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  if (!checking) return null;

  return (
    <div className="text-sm text-muted" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
      <i className="fa fa-spinner fa-spin" /> Checking for new transcripts…
    </div>
  );
}
