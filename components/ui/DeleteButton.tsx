"use client";

import { useState } from "react";

export function DeleteButton({
  action,
  confirmText = "Delete this item?",
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmText?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(confirmText)) return;
    setPending(true);
    const result = await action();
    setPending(false);
    if (result?.error) alert(result.error);
  }

  return (
    <button
      className="icon-btn"
      style={{ width: 24, height: 24, fontSize: 11, color: "var(--danger)" }}
      onClick={handleClick}
      disabled={pending}
      title="Delete"
    >
      <i className="fa fa-trash" />
    </button>
  );
}
