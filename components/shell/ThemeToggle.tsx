"use client";

import { useState } from "react";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("erp-theme") as "dark" | "light") || "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.className = next;
    localStorage.setItem("erp-theme", next);
  }

  return (
    <button className="icon-btn" title="Toggle theme" onClick={toggle}>
      <i className={`fa ${theme === "dark" ? "fa-moon" : "fa-sun"}`} suppressHydrationWarning />
    </button>
  );
}
