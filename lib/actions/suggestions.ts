"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

export type CommittedRow = {
  suggestionId: string | null; // null for a row the reviewer added by hand
  description: string;
  type: string;
  priority: string;
  processId: string;
  wasEdited: boolean;
};

// plan-agentic.md §5 step 5 — one action commits the whole batch: every
// checked row becomes a real `requirements` row (created_entity_id set);
// everything left unchecked is rejected, no reason required. Nothing else
// approves agent output — this is the only path, matching the "no
// exceptions" HITL decision.
export async function commitSuggestionBatch(
  projectId: string,
  meetingSourceId: string,
  batchId: string,
  approvedRows: CommittedRow[]
) {
  await requireEdit(projectId, "agent");
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return { error: "Not signed in" };

  for (const row of approvedRows) {
    if (!row.processId) return { error: `Pick a process for "${row.description}" before proceeding` };
    if (!row.description.trim()) return { error: "A checked row has no description" };
  }

  const nowIso = new Date().toISOString();

  for (const row of approvedRows) {
    const { data: reqRow, error: reqError } = await supabase
      .from("requirements")
      .insert({
        project_id: projectId,
        source_type: "process",
        source_id: row.processId,
        description: row.description,
        type: row.type,
        priority: row.priority,
        status: "Open",
      })
      .select("id")
      .single();
    if (reqError) return { error: reqError.message };

    if (row.suggestionId) {
      const { error: updateError } = await supabase
        .from("agent_suggestions")
        .update({
          payload: { description: row.description, type: row.type, priority: row.priority },
          was_edited: row.wasEdited,
          status: "approved",
          reviewed_by: userId,
          reviewed_at: nowIso,
          created_entity_id: reqRow.id,
        })
        .eq("id", row.suggestionId);
      if (updateError) return { error: updateError.message };
    } else {
      // Reviewer-added row the agent missed — still recorded in the same
      // batch for a full audit trail, just with origin='human_added'.
      const { error: insertError } = await supabase.from("agent_suggestions").insert({
        meeting_source_id: meetingSourceId,
        project_id: projectId,
        suggestion_type: "requirement",
        origin: "human_added",
        payload: { description: row.description, type: row.type, priority: row.priority },
        status: "approved",
        batch_id: batchId,
        reviewed_by: userId,
        reviewed_at: nowIso,
        created_entity_id: reqRow.id,
      });
      if (insertError) return { error: insertError.message };
    }
  }

  const approvedIds = approvedRows.map((r) => r.suggestionId).filter((id): id is string => !!id);
  let rejectQuery = supabase
    .from("agent_suggestions")
    .update({ status: "rejected", reviewed_by: userId, reviewed_at: nowIso })
    .eq("batch_id", batchId)
    .eq("status", "pending");
  if (approvedIds.length > 0) {
    rejectQuery = rejectQuery.not("id", "in", `(${approvedIds.join(",")})`);
  }
  const { error: rejectError } = await rejectQuery;
  if (rejectError) return { error: rejectError.message };

  await supabase.from("agent_audit_log").insert({
    project_id: projectId,
    actor_type: "human",
    actor_id: userId,
    action: "suggestions.batch_reviewed",
    entity_type: "meeting_sources",
    entity_id: meetingSourceId,
    details: { batch_id: batchId, approved: approvedRows.length },
  });

  revalidatePath("/agent");
  revalidatePath("/scope");
  refresh();
}
