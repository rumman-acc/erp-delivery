import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Module = "dashboard" | "scope" | "kanban" | "resources" | "risks" | "settings" | "agent";

// RLS is the real security boundary (plan.md §6) — this is just a friendly
// pre-check so a denied mutation reports "Forbidden" instead of silently
// affecting zero rows (a known RLS UX quirk on UPDATE/DELETE).
export async function requireEdit(projectId: string, module: Module) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_edit_module", {
    p_project_id: projectId,
    p_module: module,
  });
  if (error || !data) {
    throw new Error("Forbidden");
  }
}

// Same friendly-precheck role as requireEdit — RLS (is_super_admin() in
// every "_write_super_admin" policy) is the real boundary.
export async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error || !data) {
    throw new Error("Forbidden");
  }
}

// Used to decide whether to show nav/UI affordances at all — every existing
// module defaults to can_view=true for the User role, so this hasn't
// mattered until the 'agent' module (User role has no access to it at all).
export const canViewModule = cache(async (projectId: string, module: Module): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_view_module", {
    p_project_id: projectId,
    p_module: module,
  });
  return !error && !!data;
});

// Same RPC requireEdit() uses, but returning a boolean instead of throwing —
// lets the client know up front whether it's worth polling at all, instead
// of a view-only user's browser hitting "Forbidden" every 20 seconds.
export const canEditModule = cache(async (projectId: string, module: Module): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_edit_module", {
    p_project_id: projectId,
    p_module: module,
  });
  return !error && !!data;
});
