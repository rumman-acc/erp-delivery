import { createClient } from "@/lib/supabase/server";

export type AgentConnection = {
  id: string;
  microsoftEmail: string;
  status: "active" | "revoked" | "expired";
  connectedAt: string;
};

export async function getMyConnection(): Promise<AgentConnection | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("agent_connections")
    .select("id,microsoft_email,status,connected_at")
    .eq("connected_by", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    microsoftEmail: data.microsoft_email,
    status: data.status as AgentConnection["status"],
    connectedAt: data.connected_at,
  };
}
