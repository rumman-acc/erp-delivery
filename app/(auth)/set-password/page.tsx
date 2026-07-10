"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Reached via the Supabase invite email link — the session lives in the URL
// fragment (#access_token=...), which only the browser can see. The
// createClient() browser client picks it up on mount (detectSessionInUrl)
// and persists it to cookies, which is what proxy.ts reads on later
// requests. See proxy.ts's isSetPasswordRoute comment for the other half.
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setError("This invite link is invalid or has expired. Ask a Super Admin to send a new invite.");
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-key" /> Set Your Password
          </span>
        </div>
        {!ready && !error && <p className="text-sm text-muted">Verifying invite…</p>}
        {ready && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="label" htmlFor="password">
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 2,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 28,
                    height: 28,
                    border: "none",
                    background: "transparent",
                  }}
                >
                  <i className={showPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} />
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="confirm">
                Confirm Password
              </label>
              <input
                className="input"
                id="confirm"
                type={showPassword ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Set Password & Continue"}
            </button>
          </form>
        )}
        {!ready && error && (
          <div className="text-sm" style={{ color: "var(--danger)", marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
