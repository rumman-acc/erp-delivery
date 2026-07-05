import { createClient } from "@/lib/supabase/server";

export type TeamOption = { id: string; name: string };

export async function getTeamOptions(projectId: string): Promise<TeamOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("team_members").select("id,name").eq("project_id", projectId).order("name");
  return data ?? [];
}
