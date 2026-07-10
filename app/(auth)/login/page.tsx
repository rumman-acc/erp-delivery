"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-diagram-project" /> ERP Delivery — Sign In
          </span>
        </div>
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" id="email" name="email" type="email" required autoFocus />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="password">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
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
          {state?.error && (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              {state.error}
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
