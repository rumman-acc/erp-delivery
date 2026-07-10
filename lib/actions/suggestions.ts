"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

// A requirement row can attach to a process that already exists, or to a
// `new_process` row being created in the very same Proceed click — the
// latter is resolved to a real id only after new_process rows are inserted.
export type ProcessRef = { type: "existing"; id: string } | { type: "new"; tempKey: string };

export type CommittedRow =
  | { suggestionId: string | null; suggestionType: "requirement"; description: string; reqType: string; priority: string; processRef: ProcessRef; wasEdited: boolean }
  | { suggestionId: string | null; suggestionType: "new_process"; tempKey: string; name: string; suggestedCode: string; level: 1 | 2 | 3; description: string; priority: string; wasEdited: boolean }
  | { suggestionId: string | null; suggestionType: "action_item"; title: string; priority: string; dueDate: string | null; wasEdited: boolean }
  | { suggestionId: string | null; suggestionType: "risk"; description: string; category: string; probability: string; impact: string; mitigation: string; wasEdited: boolean }
  | { suggestionId: string | null; suggestionType: "issue"; description: string; category: string; severity: string; rootCause: string; wasEdited: boolean };

function rowLabel(row: CommittedRow): string {
  switch (row.suggestionType) {
    case "requirement":
      return row.description;
    case "new_process":
      return row.name;
    case "action_item":
      return row.title;
    case "risk":
    case "issue":
      return row.description;
  }
}

// plan-agentic.md §5 step 5 (generalized per §10 step 7) — one action
// commits the whole batch across all five suggestion types: every checked
// row becomes a real row in its destination table (created_entity_id set);
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
    if (row.suggestionType === "requirement" && row.processRef.type === "existing" && !row.processRef.id) {
      return { error: `Pick a process for "${rowLabel(row)}" before proceeding` };
    }
    if (!rowLabel(row).trim()) return { error: "A checked row has no description" };
  }

  const nowIso = new Date().toISOString();

  async function approve(row: CommittedRow, entityId: string) {
    if (row.suggestionId) {
      const { error } = await supabase
        .from("agent_suggestions")
        .update({ was_edited: row.wasEdited, status: "approved", reviewed_by: userId, reviewed_at: nowIso, created_entity_id: entityId })
        .eq("id", row.suggestionId);
      if (error) throw new Error(error.message);
    } else {
      // Reviewer-added row the agent missed — still recorded in the same
      // batch for a full audit trail, just with origin='human_added'.
      const { error } = await supabase.from("agent_suggestions").insert({
        meeting_source_id: meetingSourceId,
        project_id: projectId,
        suggestion_type: row.suggestionType,
        origin: "human_added",
        status: "approved",
        batch_id: batchId,
        reviewed_by: userId,
        reviewed_at: nowIso,
        created_entity_id: entityId,
      });
      if (error) throw new Error(error.message);
    }
  }

  try {
    // New processes commit first — a requirement row in the same batch may
    // reference one of these by tempKey rather than an existing process id.
    const newProcessIdByTempKey = new Map<string, string>();
    for (const row of approvedRows) {
      if (row.suggestionType !== "new_process") continue;
      const { data: proc, error } = await supabase
        .from("processes")
        .insert({
          project_id: projectId,
          code: row.suggestedCode,
          name: row.name,
          level: row.level,
          priority: row.priority,
          description: row.description,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") return { error: `Process code "${row.suggestedCode}" already exists — pick a different code.` };
        return { error: error.message };
      }
      newProcessIdByTempKey.set(row.tempKey, proc.id);
      await approve(row, proc.id);
    }

    for (const row of approvedRows) {
      if (row.suggestionType === "requirement") {
        const processId =
          row.processRef.type === "existing" ? row.processRef.id : newProcessIdByTempKey.get(row.processRef.tempKey);
        if (!processId) return { error: `Couldn't resolve the process for "${row.description}"` };

        const { data: req, error } = await supabase
          .from("requirements")
          .insert({
            project_id: projectId,
            source_type: "process",
            source_id: processId,
            description: row.description,
            type: row.reqType,
            priority: row.priority,
            status: "Open",
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        await approve(row, req.id);
      } else if (row.suggestionType === "action_item") {
        const { data: item, error } = await supabase
          .from("action_items")
          .insert({ project_id: projectId, title: row.title, priority: row.priority, due_date: row.dueDate, status: "Open" })
          .select("id")
          .single();
        if (error) return { error: error.message };
        await approve(row, item.id);
      } else if (row.suggestionType === "risk") {
        const { data: risk, error } = await supabase
          .from("risks")
          .insert({
            project_id: projectId,
            description: row.description,
            category: row.category,
            probability: row.probability,
            impact: row.impact,
            mitigation: row.mitigation,
            status: "Open",
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        await approve(row, risk.id);
      } else if (row.suggestionType === "issue") {
        const { data: issue, error } = await supabase
          .from("issues_log")
          .insert({
            project_id: projectId,
            description: row.description,
            category: row.category,
            severity: row.severity,
            root_cause: row.rootCause,
            status: "Open",
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        await approve(row, issue.id);
      }
      // new_process rows already handled above.
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong committing this batch" };
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
  revalidatePath("/dashboard");
  revalidatePath("/risks");
  refresh();
}
