import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/microsoft/graph";

// Kicks off the Microsoft OAuth flow (plan-agentic.md §5 step 1). A plain
// GET so the "Connect Microsoft Account" button can be a real link — OAuth
// requires an actual browser redirect to Microsoft, which a Server Action
// can't do.
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizationUrl(state));
}
