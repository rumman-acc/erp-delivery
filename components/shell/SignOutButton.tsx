"use client";

import { logout } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <button className="icon-btn" title="Sign out" onClick={() => logout()}>
      <i className="fa fa-arrow-right-from-bracket" />
    </button>
  );
}
