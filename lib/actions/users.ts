"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/permissions";

// Login is Microsoft SSO only, gated to the accelance.io tenant — every new
// sign-in defaults to Super Admin (see the on_auth_user_created trigger /
// profiles.is_super_admin default). This is the only lever left to narrow
// someone's access afterward.
export async function setSuperAdmin(userId: string, isSuperAdmin: boolean) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!isSuperAdmin && claimsData?.claims?.sub === userId) {
    return { error: "You can't remove your own Super Admin access." };
  }

  const { error } = await supabase.from("profiles").update({ is_super_admin: isSuperAdmin }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  refresh();
}
