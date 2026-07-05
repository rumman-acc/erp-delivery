"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function disconnectMicrosoft() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { error: "Not signed in" };

  // Filtered explicitly to the caller's own row — RLS would also allow a
  // Super Admin to delete here, but without this filter a Super Admin
  // disconnecting "their own" account could wipe every connection in the
  // table (delete() with no filter deletes every row RLS permits).
  const { error } = await supabase.from("agent_connections").delete().eq("connected_by", userId);
  if (error) return { error: error.message };

  await supabase.from("agent_audit_log").insert({
    actor_type: "human",
    actor_id: userId,
    action: "connection.revoked",
    entity_type: "agent_connections",
  });

  revalidatePath("/agent");
  refresh();
}
