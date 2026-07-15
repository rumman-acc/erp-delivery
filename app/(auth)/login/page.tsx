"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  sso_failed: "Microsoft sign-in didn't complete — please try again.",
};

export default function LoginPage() {
  const [pending, setPending] = useState(false);
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const errorCode = params?.get("error") ?? null;

  async function handleSignIn() {
    setPending(true);
    const supabase = createClient();
    // Azure AD app registration is Single tenant (accelance.io only) — the
    // tenant itself is the access gate, not anything in this app's code.
    // Supabase's Azure provider defaults to `scope=openid` only, which
    // returns no email claim — explicit "email profile" is what makes
    // Microsoft's response include the address Supabase needs to create
    // the user (without it: "Error getting user email from external provider").
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
      },
    });
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-diagram-project" /> Accelance Tracker
          </span>
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
          Sign in with your accelance.io Microsoft account.
        </p>
        {errorCode && (
          <div className="text-sm" style={{ color: "var(--danger)", marginBottom: 12 }}>
            {ERROR_MESSAGES[errorCode] ?? "Something went wrong signing in."}
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSignIn}
          disabled={pending}
          style={{ width: "100%", justifyContent: "center" }}
        >
          <i className="fa-brands fa-microsoft" /> {pending ? "Redirecting…" : "Sign in with Microsoft"}
        </button>
      </div>
    </div>
  );
}
