"use server";

import { headers } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperAdmin } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Supabase's admin invite email links back to a redirect_to URL of our
// choosing — built from the request host rather than a hardcoded env var
// so it's automatically correct on localhost, previews, and production.
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("host")}`;
}

export async function inviteUser(projectId: string, formData: FormData) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const email = str(formData, "email");
  const roleId = str(formData, "role_id");
  if (!email || !roleId) return { error: "Email and role are required" };

  const { data: claimsData } = await supabase.auth.getClaims();
  const invitedBy = claimsData?.claims?.sub as string | undefined;

  // Requires the service-role key — auth.admin.* methods can't run under
  // the anon/RLS-scoped client. This creates the auth.users row immediately
  // (profiles gets one too, via the on_auth_user_created trigger) and
  // emails the invite; the user sets their own password at /set-password.
  const { data: inviteData, error: inviteError } = await createServiceClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${await siteOrigin()}/set-password`,
  });
  if (inviteError) return { error: inviteError.message };

  const userId = inviteData.user?.id;
  if (!userId) return { error: "Invite sent, but Supabase did not return a user id" };

  // upsert: re-inviting someone already on the project just updates their role.
  const { error: memberError } = await supabase
    .from("project_members")
    .upsert(
      { project_id: projectId, user_id: userId, role_id: roleId, invited_by: invitedBy },
      { onConflict: "project_id,user_id" }
    );
  if (memberError) return { error: memberError.message };

  revalidatePath("/dashboard");
  refresh();
}

export async function removeMember(projectId: string, userId: string) {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  refresh();
}
