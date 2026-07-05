# ERP Delivery App — Reverse-Engineering & Rebuild Plan

Source analyzed: `https://harmonious-peony-5e9496.netlify.app/` (single-page app, "ERP Delivery App — D365 BC Implementation" tracker)

## 1. Key Finding: There Is No Backend API

I fetched the raw HTML/JS (not the rendered DOM) directly with `curl` and inspected the full ~3,200-line source. The entire application is:

- **One static HTML file** (`index.html`) with all CSS and JS inlined in `<style>`/`<script>` tags. No separate JS bundles, no build step (no webpack/vite manifest, no `/static/` or `/assets/` chunk files).
- **No framework** — vanilla JS, hand-rolled router, hand-rolled DOM rendering (template strings + `innerHTML`), a single global event-delegation handler keyed off `data-action` attributes.
- **Only external dependency**: Font Awesome CSS from `cdnjs.cloudflare.com` (icons only, no JS).
- **Zero network calls.** I grepped the entire source for `fetch(`, `axios`, `XMLHttpRequest`, `supabase`, `firebase`, any `api`/`API_URL` pattern — none exist. There is no backend, no database, no auth, because there is nothing to authenticate against.
- **All persistence is `localStorage`**, in the browser, per-device:
  - Data: `localStorage['erp-delivery-v2']` — one JSON blob containing the entire app state.
  - Theme: `localStorage['erp-theme']` — `'dark'` or `'light'`.
- Routing is hash-based (`#dashboard`, `#scope`, `#kanban`, `#resources`, `#risks`) purely client-side.

**Implication for "migrate the data to our database":** there is no live/shared dataset anywhere to scrape via an API — every visitor gets their own private copy seeded from the same hardcoded defaults on first load, stored only in their own browser. "Migration" therefore means: (1) import the seed/reference dataset captured from source (§3), and (2) if a real user has since-modified data sitting in *their* browser, recover it via a one-line console export (§8) — it cannot be fetched remotely.

## 2. Current Application Map

| Route | Module | Purpose |
|---|---|---|
| `#dashboard` | `App.Pages.Dashboard` | KPIs, Gantt chart (SVG, hand-drawn) of phases, milestone gates (RAG status), action items list |
| `#scope` | `App.Pages.Scope` | Business Process Model: hierarchical process tree (L1→L2→L3) with detail tabs (overview, org units, requirements, dependencies, linked kanban issues) + Data Elements (migration objects) view with its own detail tabs |
| `#kanban` | `App.Pages.Kanban` | Issue tracker: board / backlog / list views, columns with WIP limits, sprints, epics/stories/tasks/bugs, comments, blocking links, effort-by-role estimation |
| `#resources` | `App.Pages.Resources` | Team roster, planned vs. logged hours, cost/rate, budget utilization bar, hours log with manual time entries |
| `#risks` | `App.Pages.Risks` | Risk register (probability × impact scoring) + separate Issues Log register, tabbed |
| Settings modal (gear icon) | `App.Settings` | Project meta (name, client, ERP system, go-live date, issue prefix, budget), team management, org units management, "Reset All Data" |

Cross-cutting: dark/light theme toggle, toast notifications, a single reusable modal component, inline-editable table cells everywhere (bound via `data-action`).

## 3. Full Data Model (extracted verbatim from `App.State.init()`)

This is the exact shape of the one JSON object persisted to `localStorage['erp-delivery-v2']`. Use this as the source of truth for the target schema.

```
config: {
  name, client, erp, goLive, prefix, issueCounter, deCounter, drCounter, budget,
  team: [{ id, name, role, location, plannedHours, rate, loggedHours }],
  orgUnits: [{ id, location, region, strategicBU, businessUnit, type, inScope }]
}
phases:      [{ id, name, start, end, color, progress }]
gates:       [{ id, name, date, status(green|amber|red|grey), responsible, notes }]
actions:     [{ id, title, owner, due, status, priority }]
processes:   [{ id, name, level, parent, inscope, priority, expanded, description, notes,
                 orgUnits[], requirements[{id,desc,type,priority,status}],
                 processDeps[], dataDeps[], kanbanLinks[] }]
dataElements:[{ id, name, category, description, owner, source, target, volume, complexity, inscope,
                 linkedProcesses[{pid, direction}], orgUnits[],
                 requirements[{id,desc,type,priority,status,note,kanbanIssue,sprint}], kanbanLinks[] }]
columns:     [{ id, name, color, wipLimit, order }]
sprints:     [{ id, name, goal, startDate, endDate, status }]
issues:      [{ id, type(Epic|Story|Task|Bug|Sub-task), title, description, priority, status,
                 assignee, effortByRole{role:days}, epic, sprint, labels[], processLink,
                 blocks[], blockedBy[], comments[{id,author,text,timestamp}], epicColor,
                 created, updated }]
risks:       [{ id, description, category, probability(H|M|L), impact(H|M|L), mitigation, owner, status }]
issuesLog:   [{ id, description, category, severity, rootCause, resolution, owner, due, status }]
hoursLog:    [{ id, date, person, hours, activity, notes }]
```

The seed data itself (4 team members, 4 org units, 5 phases, 5 gates, 3 actions, ~40 BPM processes across FI/CO/SCM/SD/HR/INT/MDM, 4 data elements, 5 kanban columns, 2 sprints, 5 issues, 3 risks, 2 logged issues, 3 hours-log entries) is the demo/reference dataset used to seed the rebuilt app.

## 4. Decisions & Target Architecture

Resolved with you:

- **Tenancy model: single org, multiple projects.** One company (yours) runs many ERP delivery projects side by side (the current "Acme Corp / D365 BC" project becomes just one row in a `projects` table). One shared pool of internal users, assignable to one or more projects with different roles per project. No cross-company data isolation needed — this is *not* a multi-tenant SaaS for external client logins.
- **Stack: Next.js + Supabase.**
  - **Frontend/Backend**: Next.js (App Router). Use **Server Actions** for mutations and **Server Components**/Route Handlers for reads — no separate Express/NestJS service needed since Supabase covers Postgres + Auth + (optionally) Storage directly.
  - **Database**: Supabase Postgres, schema in §5.
  - **Auth**: Supabase Auth (email/password, invite-by-email flow) — the one deliberate capability gap vs. the source app, since it currently has none.
  - **Authorization**: custom RBAC layer on top of Supabase Auth, enforced via Postgres **Row Level Security (RLS)** as the real security boundary, with Next.js-side checks for UX — full design in §6.
- **Code style**: since you're moving off vanilla JS to Next.js anyway, this is a genuine rebuild, not a line-for-line clone — but the UI/CSS/IA should stay visually 1:1 with the source (the extracted CSS is plain custom-property based and ports over almost unchanged).

## 5. Proposed Relational Schema (Supabase Postgres)

Core domain tables (map 1:1 to the localStorage object in §3, normalized), plus RBAC tables (§6 has the detail):

```
projects            (id, name, client, erp_system, go_live_date, issue_prefix, budget, issue_counter, de_counter, dr_counter, created_at, updated_at)
team_members        (id, project_id FK, name, role, location, planned_hours, rate, logged_hours)
org_units           (id, project_id FK, location, region, strategic_bu, business_unit, type, in_scope)
phases              (id, project_id FK, name, start_date, end_date, color, progress)
gates               (id, project_id FK, name, date, status, responsible_id FK->team_members, notes)
action_items        (id, project_id FK, title, owner_id FK->team_members, due_date, status, priority)
processes           (id, project_id FK, code, name, level, parent_id FK->processes(self), in_scope, priority, description, notes)
process_org_units   (process_id FK, org_unit_id FK)
process_deps        (process_id FK, depends_on_process_id FK)
requirements        (id, project_id FK, source_type ENUM(process,data_element), source_id, description, type, priority, status, note)
data_elements       (id, project_id FK, name, category, description, owner_id FK->team_members, source_system, target_system, volume, complexity, in_scope)
data_element_process_links (data_element_id FK, process_id FK, direction)
data_element_org_units     (data_element_id FK, org_unit_id FK)
columns             (id, project_id FK, name, color, wip_limit, sort_order)
sprints             (id, project_id FK, name, goal, start_date, end_date, status)
issues              (id, project_id FK, key, type, title, description, priority, status_column_id FK->columns,
                      assignee_id FK->team_members, epic_id FK->issues(self), sprint_id FK->sprints,
                      process_link_id FK->processes, epic_color, created_at, updated_at)
issue_effort_by_role(issue_id FK, role, days)
issue_labels        (issue_id FK, label)
issue_links         (issue_id FK, linked_issue_id FK, link_type ENUM(blocks,blocked_by))
issue_comments      (id, issue_id FK, author_id FK->team_members, text, created_at)
risks               (id, project_id FK, description, category, probability, impact, mitigation, owner_id FK->team_members, status)
issues_log          (id, project_id FK, description, category, severity, root_cause, resolution, owner_id FK->team_members, due_date, status)
hours_log           (id, project_id FK, date, team_member_id FK, hours, activity, notes)
kanban_links        (source_type ENUM(process,data_element), source_id, issue_id FK->issues)
```

Notes:
- Every table gets `project_id` so the rebuilt app can host multiple ERP delivery projects (the source app hardcodes exactly one).
- The human-readable source IDs (`ERP-001`, `RSK-001`, `DE-001`) become a `key`/`code` column separate from the internal UUID primary key, since the UI and cross-references depend on them.
- `team_members` (functional/consulting staff tracked for hours & cost) is a distinct concept from `profiles`/login users (§6) — a team member doesn't necessarily have a login, and a login user isn't necessarily billed hours. Link them optionally via `team_members.user_id FK->profiles` if a team member should also be able to log in.

## 6. RBAC & Access Control Design

**Roles:**

| Role | Scope | Access |
|---|---|---|
| **Super Admin** | Global (not tied to any one project) | Everything: create/manage projects, invite users, promote users to Admin or Super Admin, create dynamic roles, full CRUD everywhere |
| **Admin** | Per-project (assigned) | Full CRUD on all modules within their assigned project(s) |
| **User** (default) | Per-project (assigned) | View-only on all modules within their assigned project(s) |
| **Dynamic role** | Per-project (assigned) | Custom module-level view/edit matrix, defined by Super Admin |

Note the assumption: Admin/User/dynamic-role assignment is **per project** (a person can be Admin on Project A and just a Viewer on Project B) — this fits the "single org, multiple projects" model since your consultants typically aren't on every engagement. Super Admin is the only global tier, sitting above the per-project system entirely.

**Schema additions:**

```
profiles                  (id PK = auth.users.id FK, full_name, email, avatar_url, is_super_admin boolean default false, created_at)
roles                     (id, name, is_system boolean, description, created_by FK->profiles, created_at)
  -- seeded system rows: 'Admin' (is_system=true), 'User' (is_system=true)
  -- Super Admin is NOT a row here — it's the profiles.is_super_admin flag, above the whole per-project role system
role_module_permissions   (role_id FK, module ENUM('dashboard','scope','kanban','resources','risks','settings'), can_view boolean default true, can_edit boolean default false)
project_members           (project_id FK, user_id FK->profiles, role_id FK->roles, invited_by FK->profiles, created_at, PRIMARY KEY(project_id, user_id))
invites                   (id, email, project_id FK, role_id FK, invited_by FK->profiles, token, status ENUM(pending,accepted,expired,revoked), created_at, expires_at)
```

**Default seeded permission matrix:**

| Role | Dashboard | Scope & BPM | Kanban | Resources | Risks & Issues | Project Settings |
|---|---|---|---|---|---|---|
| Admin | view+edit | view+edit | view+edit | view+edit | view+edit | view+edit |
| User | view | view | view | view | view | no access |
| *(dynamic)* | Super Admin toggles view/edit per module individually |

**Permission resolution (server-side, pseudocode):**
```ts
function can(user, projectId, module, action: 'view'|'edit') {
  if (user.is_super_admin) return true;
  const membership = getProjectMember(projectId, user.id);
  if (!membership) return false; // not on this project at all
  const perm = getRoleModulePermission(membership.role_id, module);
  return action === 'view' ? perm.can_view : perm.can_edit;
}
```

**Flows:**
- **Invite a brand-new person** (Super Admin only): sends an invite (email + project + role) → `invites` row created → Supabase Auth Admin `inviteUserByEmail` sends the email. On acceptance, a `profiles` row is created/linked and a `project_members` row is added with the invited role (defaults to `User`/view-only if unspecified).
- **Add an existing user to a project** (project Admin can do this too): Admin picks a user who already has a `profiles` row (platform login exists) and adds a `project_members` row directly with a chosen role — no email/invite step, since the person already has an account.
- **Promote to Admin**: Super Admin, or that project's existing Admin, changes a user's `project_members.role_id` to `Admin` for that specific project.
- **Promote to Super Admin**: Super Admin sets `profiles.is_super_admin = true` for a target user.
- **Create a dynamic role**: Super Admin names a new role and toggles view/edit per module in `role_module_permissions`; it's then assignable via `project_members.role_id` exactly like Admin/User.
- **Bootstrapping the very first Super Admin**: since no one exists yet to send an invite, flip `profiles.is_super_admin = true` directly via a one-time SQL statement (or a seed script) for the first account after they sign up.

**Enforcement — this matters specifically because of Supabase:**
- Enable **Row Level Security (RLS)** on every project-scoped table, with policies keyed off `project_members` + `profiles.is_super_admin`. This is the real security boundary — if the Supabase client is ever called directly from the browser (common in Supabase apps), RLS is what actually stops an unauthorized read/write, not a Next.js route check alone.
- Next.js Server Actions/Route Handlers should still run the same `can()` check server-side for clean UX (proper error messages, hiding buttons/UI a user can't use) — treat this as UX, and RLS as the actual enforcement.

## 7. API Surface

Prefer **Server Actions** for mutations (idiomatic in Next.js App Router, less boilerplate than hand-rolled REST); use Route Handlers under `/api/...` only where you need a stable HTTP contract (e.g., if a future mobile client needs it). RBAC-specific endpoints/actions needed (none of this exists in the source app — it's net-new):

```
createInvite(email, projectId, roleId)        // Super Admin only — brand-new person, no account yet
acceptInvite(token)
addExistingMemberToProject(projectId, userId, roleId)   // Super Admin or that project's Admin
listProjectMembers(projectId)
updateMemberRole(projectId, userId, roleId)   // Super Admin or that project's Admin
removeMember(projectId, userId)               // Super Admin or that project's Admin
resetProjectData(projectId)                    // that project's Admin only — wipes just this project, no platform-wide equivalent
listRoles() / createRole(name, permissions) / updateRole(id, permissions)   // Super Admin only
promoteToSuperAdmin(userId)                    // Super Admin only
```

Plus standard CRUD actions for every resource in §5 (issues, risks, processes, data elements, phases, gates, actions, team members, org units, hours log), each guarded server-side by `can(user, projectId, module, action)` and backed by the matching RLS policy.

## 8. Migration Script — Pulling Real Data Out (if any exists)

Because data lives only in each visitor's browser, if the live Netlify instance has actual project data entered by a real user (not just the demo defaults), the only way to recover it is client-side. Have that person run this in DevTools console on the live site and send you the output:

```js
copy(localStorage.getItem('erp-delivery-v2'))
```

That JSON pastes directly onto the clipboard and can be fed to a one-off import script that walks the object shape in §3 and inserts rows into the schema in §5, preserving the existing string IDs as the `key`/`code` column.

If no real data has ever been entered (most likely, given this looks like a demo/POC), "migration" is simply: seed the new Supabase DB with the same default dataset from §3, scoped under a seeded `project_members` for whichever real users should have access, and real usage begins against the real database going forward.

## 9. Build Plan / Phases

1. **Supabase project setup** — Postgres schema (§5 + §6), RLS policies, Supabase Auth config (email/password + invite emails).
2. **Design system port + visual shell** (see §11 for the full detail) — copy the source CSS verbatim into `app/globals.css`, build the shared UI primitives (Button, Card, Badge, Modal, Toast, Table, Tabs, ProgressBar, Avatar) and the sidebar/header shell with identical markup/classes to the source. **Checkpoint: put the running shell side-by-side against the live Netlify instance and confirm pixel parity before wiring any data or auth** — cheapest point to catch drift.
3. **Next.js scaffold + Supabase wiring** — App Router route structure (§11), Supabase client (browser + server helpers), auth pages (login, accept-invite).
4. **RBAC core** — `profiles`/`roles`/`project_members`/`invites` tables live; bootstrap the first Super Admin manually; build the invite-and-accept flow; build a Super-Admin-only "Users & Roles" panel (assign Admin/User per project, add-existing-member flow, build dynamic roles via the module permission matrix) — **this whole panel is net-new, doesn't exist in the source app at all; style it with the same tokens/classes from §11, not a new design language.**
5. **Seed data** — load the default dataset from §3 into a first `project`, with `project_members` rows for whichever real users should see it.
6. **Dashboard page** — Gantt (reuse the exact SVG-generation math from source, it's dependency-free), gates, action items — gated by the `dashboard` module permission.
7. **Scope & BPM page** — process tree + data elements, gated by `scope`.
8. **Kanban page** — board/backlog/list views, sprints, comments, blocking links, gated by `kanban`.
9. **Resources page** — team table, budget, hours log, gated by `resources`.
10. **Risks & Issues page** — risk register + issues log, gated by `risks`.
11. **Settings** — project meta tab (Admin+), team/org-unit tabs — separate from the Super-Admin "Users & Roles" panel in step 4.
12. **Data migration** — run §8 if real browser data exists; otherwise seed-only.
13. **Parity + RBAC QA pass** — page-by-page visual/behavior parity against the live Netlify instance, *plus* an explicit RBAC test matrix: confirm a `User` truly cannot edit anywhere (UI, server action, and RLS all three), an `Admin` cannot reach the Users & Roles panel, and a custom dynamic role's module toggles are honored end-to-end.

## 10. Resolved Decisions (was "Open Questions")

**Inviting users — split into two distinct actions, not one:**
- **Add existing user to project** — a person who already has a platform login (from being on another project) can be added to a new project by that project's **Admin**. This is just a `project_members` insert, no new identity created, and it keeps Admins unblocked for routine team staffing instead of queuing every addition through Super Admin.
- **Invite brand-new person** (no account yet) — **Super-Admin-only**, per your original wording. Creating a new login credential in the system is the more sensitive action and should stay centrally controlled.

**"Reset All Data" — project-scoped, Admin-level, no platform-wide version:**
- Reframed as **"Reset Project Data"** — wipes only the calling project's records (phases, gates, issues, risks, etc.) back to empty. Available to that project's **Admin**, since it's a natural extension of the delete access Admins already have — and critically, it *cannot* touch other projects.
- A platform-wide "wipe everything" button is deliberately **not** carried over from the source app — with real Supabase data across multiple projects (vs. one project's disposable localStorage in the source), that's disproportionately destructive for a settings-modal button. A true full wipe should be a manual DB operation, not a UI action.
- Safety upgrade vs. source app: replace the plain JS `confirm()` with a **type-the-project-name-to-confirm** pattern before executing, since there's no undo on real database rows.

## 11. Design System — Exact Visual Replication (CSS/Theme)

The source stylesheet is only ~209 lines, entirely driven by CSS custom properties, with zero framework (no Tailwind/Bootstrap). This is good news for pixel parity: **port it verbatim rather than translating it into a different styling system.** Translating hand-written CSS into Tailwind utility classes is exactly the kind of mechanical, error-prone step that introduces visual drift (off-by-one paddings, slightly wrong shades, missed hover states) — with a stylesheet this small and clean, there's no benefit to rewriting it.

### Theme tokens (exact values, extracted from source)
```css
html.dark{--bg:#0f172a;--surface:#1e293b;--surface2:#334155;--border:#475569;--text:#f1f5f9;--text-muted:#94a3b8}
html.light{--bg:#f8fafc;--surface:#ffffff;--surface2:#f1f5f9;--border:#e2e8f0;--text:#0f172a;--text-muted:#64748b}
:root{--accent:#6366f1;--success:#10b981;--warning:#f59e0b;--danger:#ef4444;--info:#3b82f6;--radius:8px}
```
Theme switches by toggling the `dark`/`light` class on `<html>` — same mechanism carries over unchanged into Next.js.

**Note on typography**: the source declares `font-family:system-ui,-apple-system,'Inter',sans-serif` but never actually loads an Inter web font file anywhere — so on virtually every machine it silently renders as the OS system font (San Francisco / Segoe UI / Roboto), not real Inter. For exact behavioral parity, keep this as-is (don't load Inter). Only load it for real if you'd *prefer* crisper, consistent-across-OS typography — that would be a deliberate improvement over the source, not a parity requirement, so it's your call.

### Layout shell (exact px values to preserve)
- Sidebar: `220px` fixed width
- Header: `52px` fixed height
- Card padding `20px`, radius `8px` (`--radius`)
- Modal sizes: sm `480px` / md `640px` / lg `900px` / xl `1200px` / full `90vw × 90vh`
- Base font size `14px`, body font stack as above

### Component inventory → target React components
| CSS class family | Used in | Target component |
|---|---|---|
| `.btn`, `.btn-primary/secondary/danger/ghost/success`, `.btn-sm/xs`, `.icon-btn` | everywhere | `<Button>` |
| `.card`, `.card-header`, `.card-title` | every page | `<Card>` |
| `.badge`, `.badge-success/warning/danger/info/neutral/purple` | priority/status pills | `<Badge>` |
| `.chip` | labels | `<Chip>` |
| `.table-auto` | Resources, Kanban backlog/list, Risks | `<Table>` |
| `.form-group`, `.label`, `.input/select/textarea` | all modals/forms | form primitives |
| `.tab-bar`, `.tab-item` | Risks tabs, Settings tabs | `<Tabs>` |
| `#modal-overlay`, `.modal`, `.modal-header/body/footer` | global modal | `<Modal>` (React context, replaces `App.UI.Modal.open/close`) |
| `.progress-bar`, `.progress-fill` | phase progress, budget bar | `<ProgressBar>` |
| `.avatar` | assignees | `<Avatar>` (reuse the exact initials + hash-based color algorithm from `App.UI.avatarInitials/avatarColor`) |
| `#toast-container`, `.toast` | notifications | `<Toaster>` |
| `.kpi-grid`, `.kpi-card`, `.kpi-label/value/sub` | Dashboard | `<KpiCard>` |
| `.gantt-svg` | Dashboard | `<GanttChart>` — port the exact SVG math (`toX()` scaling, month labels, today-line) from the source's `renderGantt()` |
| `.kanban-board`, `.kanban-col`, `.kanban-card`, `.kanban-quickadd` | Kanban | `<KanbanBoard>` |
| `.scope-layout`, `.tree-node`, `.tree-l1/l2/l3` | Scope & BPM | `<ProcessTree>` |
| `.de-layout`, `.de-item` | Data Elements | `<DataElementList>` |
| `.rag-dot`, `.risk-score-*`, `.priority-*` | status dots, risk matrix, priority text | shared style helpers |
| `.inline-edit` | inline-editable table cells (used throughout) | `<InlineEditCell>` |

### Icons
Font Awesome 6.5.0, loaded from `cdnjs.cloudflare.com` — keep the exact same CDN `<link>` in the Next.js root layout rather than swapping icon sets. Every `fa fa-xxx` class in the source maps directly to a JSX `className="fa fa-xxx"` with zero translation.

### What to copy verbatim vs. what to rebuild
- **Copy verbatim into `app/globals.css`**: the entire stylesheet, unchanged, token-for-token.
- **Rebuild as React components** (behavior only, not styling): sidebar/header shell, modal system, toast system, tables, forms, the Gantt SVG generator, Kanban board, scope tree, data element list — give them the *same class names and DOM structure* as the source so the copied CSS applies with no modification needed.
- **Net-new UI with no source equivalent** (login page, invite-acceptance page, Super-Admin "Users & Roles" panel): style these using the *same* tokens and existing classes (`--accent`, `.card`, `.btn`, `.badge`, `.table-auto`, etc.) rather than inventing a new visual language, so they feel native to the rest of the app.

### Route structure (replaces hash-router show/hide divs)
The source shows/hides five `<div class="page">` elements via JS (`App.Router.navigate`); the rebuild uses real Next.js routes instead — a genuine improvement (deep links, working browser back button) while keeping the identical shared shell:
```
app/
  layout.tsx                     <- <html class="dark">, loads globals.css + Font Awesome CDN link, theme-flash-prevention script
  (auth)/
    login/page.tsx
    invite/[token]/page.tsx
  (app)/
    layout.tsx                   <- sidebar + header shell, identical markup/classes to source
    [projectId]/
      dashboard/page.tsx
      scope/page.tsx
      kanban/page.tsx
      resources/page.tsx
      risks/page.tsx
      settings/page.tsx
    admin/
      users-and-roles/page.tsx   <- net-new, Super Admin only
components/
  ui/        (Button, Card, Badge, Chip, Modal, Toast, Tabs, ProgressBar, Avatar, Table, InlineEditCell)
  dashboard/ (GanttChart, KpiCard, GatesTable, ActionsTable)
  scope/     (ProcessTree, ProcessDetail, DataElementList, DataElementDetail)
  kanban/    (KanbanBoard, KanbanColumn, KanbanCard, IssueModal)
  resources/ (TeamTable, BudgetCard, HoursLog)
  risks/     (RiskTable, IssuesLogTable)
  admin/     (MembersTable, RoleBuilder, InviteForm)
lib/
  supabase/       (client.ts — browser, server.ts — server w/ cookies)
  permissions.ts  <- the can() function from §6
  actions/        <- Server Actions, one file per resource (issues.ts, risks.ts, processes.ts, ...)
```

### Avoiding flash-of-wrong-theme
The source sets `document.documentElement.className` synchronously, before paint, in an inline script reading `localStorage['erp-theme']`. Next.js needs the same trick manually — a small blocking inline `<script>` in the root `<head>`, run before hydration, reading the same key — because the server can't know the client's stored theme preference ahead of time (SSR would otherwise flash the default theme first).
