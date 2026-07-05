"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "fa-gauge-high", label: "Dashboard" },
  { href: "/scope", icon: "fa-sitemap", label: "Scope & BPM" },
  { href: "/kanban", icon: "fa-table-columns", label: "Kanban Board" },
  { href: "/resources", icon: "fa-users", label: "Resources" },
  { href: "/risks", icon: "fa-triangle-exclamation", label: "Risks & Issues" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div id="sidebar">
      <div className="sidebar-logo">
        <i className="fa-solid fa-diagram-project" />
        ERP Delivery
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${pathname.startsWith(item.href) ? " active" : ""}`}
          >
            <i className={`fa ${item.icon}`} /> {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">v1.0</div>
    </div>
  );
}
