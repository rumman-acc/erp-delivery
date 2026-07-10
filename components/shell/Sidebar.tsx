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

export function Sidebar({ showAgentNav }: { showAgentNav: boolean }) {
  const pathname = usePathname();

  const items = showAgentNav ? [...NAV_ITEMS, { href: "/agent", icon: "fa-robot", label: "AI Agent" }] : NAV_ITEMS;

  return (
    <div id="sidebar">
      <div className="sidebar-logo">
        <i className="fa-solid fa-diagram-project" />
        ERP Delivery
      </div>
      <nav>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${pathname.startsWith(item.href) ? " active" : ""}`}
          >
            <i className={`fa ${item.icon}`} /> {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
