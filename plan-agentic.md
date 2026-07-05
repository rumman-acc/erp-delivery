# Agentify Plan — Meeting-to-Data Automation (Teams/Outlook Agent)

Companion to `plan.md`. This covers turning the ERP Delivery App into something that listens to Microsoft Teams meetings and proposes structured project data (starting with **requirements**) for a human to approve — instead of someone manually re-typing what was discussed.

## Decisions Locked In

- **Permission model**: delegated OAuth, per admin — every Admin has their own login and connects their **own** Microsoft account independently (not one shared/singleton connection for the whole org). Each admin only ever sees meetings they're personally part of — no tenant-wide access, no Global Admin consent needed to start. The schema was already designed this way (`agent_connections` is one row per admin, not a singleton).
- **Meeting selection**: each admin browses their own calendar and explicitly links whichever specific Teams meetings they want to a project — not every meeting they attend, only the ones they choose.
- **V1 scope**: one use case, fully working, before generalizing — Teams meeting → transcript → extracted **requirements** → HITL review queue → approved → lands in the database. The data model is still designed to generalize (see §5) so adding risks/action-items/decisions later doesn't require a schema rewrite.
- **HITL strictness**: **everything** the agent extracts requires human approval before it becomes real project data. No auto-create path, no exceptions, even for "low-risk" items.
- **Review UX**: batch checklist, not one-by-one approve/reject. Everything the agent extracted from one meeting shows up together on one screen, **unchecked by default** — the admin actively checks the ones that are valid, can edit any row inline before committing, can add a row the agent missed, then clicks one "Proceed" to commit the whole batch in a single action. Unchecked rows are simply discarded, no rejection-reason prompt needed.
- **Reviewer scope**: any Admin on the project can review and act on a meeting's suggestion batch, not just the admin whose Outlook account happened to source that meeting — review responsibility sits at the project level, consistent with how every other module already works (Admin = full CRUD across the whole project).
- **Explicitly deferred, not decided**: whether admins from genuinely different organizations (different Azure AD tenants — e.g. two separate client companies) will ever log into the *same* running instance of this app. That would be true multi-tenant SaaS and reopens the tenancy decision in `plan.md` §4 (currently "single org, multiple projects," no company-level data boundary at all in RBAC). For now, this build assumes every admin who connects Outlook belongs to the **one same organization/Azure AD tenant** this app is deployed for. The Azure AD app registration is **Single tenant**, scoped to that one org, on purpose — do not switch it to Multi-tenant without first designing the company-boundary problem this would reopen.

## 1. Why This Is Sensitive (Governance Framing)

Before the architecture: three things make this different from everything built so far, and worth stating explicitly rather than discovering later.

- **You're touching a second identity system.** Every connected account is a real Microsoft 365 identity with real access to that person's calendar and meetings. A bug here doesn't just corrupt a row in your database — it can leak or mishandle someone's meeting content.
- **Transcripts are sensitive by default**, not because of what's in them specifically, but because you can't know what's in them until you've already ingested them (a meeting "about requirements" can easily drift into salary discussions, HR issues, client complaints, etc.). Treat every transcript as sensitive, unconditionally.
- **Recording/transcription consent is a legal question, not just a technical one.** Teams shows participants a consent banner when transcription is enabled, but that's Microsoft's generic notice — it doesn't automatically satisfy your organization's own obligations (many jurisdictions require clear notice of *what happens to the data afterward*, e.g. "an AI system will read this transcript and propose it as a project requirement"). This plan assumes your organization separately confirms this is acceptable under its meeting/recording policy — that's a people decision, not something I can implement around.

## 2. Architecture Overview

```
Outlook/Teams (Microsoft 365)
        │  OAuth (delegated, admin's own account)
        ▼
Next.js app ── /api/integrations/microsoft/*  (Route Handlers — OAuth callback, token refresh)
        │
        ├── New sidebar nav item "AI Agent" (Admin+ only, gated by the
        │   'agent' module permission) — connection status card at the top,
        │   "Your Meetings" list below it once connected, with a
        │   "Link to this project" action per unlinked meeting
        │
        ├── Scheduled job (cron) — polls linked meetings that have ended,
        │   fetches the transcript via Microsoft Graph once available
        │
        ├── Extraction step — sends transcript to Claude with a structured
        │   output schema ("extract candidate requirements"), gets back
        │   {description, type, priority, supporting quote} per item
        │
        ├── agent_suggestions table (status: pending) — nothing here is
        │   real project data yet
        │
        └── HITL Review Queue (new page, any project Admin) — one batch per
            meeting, shown as an unchecked-by-default checklist. Check the
            valid ones, edit inline, add anything missed, click "Proceed"
            once. Only then does anything become a real row in
            `requirements` (via the same Server Action pattern as everything
            else in the app), with a permanent link back to the source
            meeting for traceability.
```

Everything after "extraction" reuses patterns you already have: Server Actions, RLS, the `requireEdit`-style permission check, `refresh()` after mutation. This is deliberately not a separate service — same Next.js app, same Supabase database, new tables and routes.

## 3. Microsoft Graph Setup (what you'll need to actually do, outside code)

1. **Register an app in Azure AD (Entra ID)** — in your org's Azure Portal → App registrations → New registration. You'll need Application (client) ID + a client secret (or certificate).
2. **Redirect URI**: `https://<your-app-domain>/api/integrations/microsoft/callback` (and a `localhost` one for dev).
3. **Delegated permissions to request** (least-privilege — only what's needed for this one use case):
   - `offline_access` — required to get a refresh token so the connection survives beyond one login
   - `User.Read` — basic profile of the connecting admin
   - `Calendars.Read` — to list their meetings and let them pick which one to link to a project
   - `OnlineMeetings.Read` — to resolve calendar events to Teams online-meeting IDs
   - `OnlineMeetingTranscript.Read.All` — to fetch the transcript once available
   - Explicitly **not** requesting `Mail.Read`, `Chat.Read`, or anything tenant-wide — you don't need them for this use case, and every extra scope is more surface area to justify to compliance later.
4. **Teams transcription must actually be enabled** for the org (or at least for this admin) — Microsoft Graph can only fetch a transcript if Teams generated one, which requires transcription to have been turned on for that meeting. This is an org policy setting, not something the app controls.
5. Consent here is per-admin ("Accept" on first connect) — no Global Admin action needed, consistent with the delegated model chosen.

## 4. New Database Schema

```sql
-- One row per connected Microsoft account, per admin — multiple admins each
-- get their own independent row; there is no single shared/singleton connection.
create table public.agent_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by uuid not null references public.profiles(id) on delete cascade,
  microsoft_user_id text not null,
  microsoft_email text not null,
  encrypted_refresh_token bytea not null,   -- pgcrypto pgp_sym_encrypt, see §6
  scopes text[] not null,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);

-- A calendar/Teams meeting that's been linked to a project (manual link, not auto-matched — see §7).
create table public.meeting_sources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.agent_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  graph_event_id text not null,           -- calendar event id
  graph_meeting_id text,                  -- resolved online meeting id (once known)
  subject text not null,
  organizer_email text,
  start_time timestamptz not null,
  end_time timestamptz,
  linked_by uuid references public.profiles(id),
  transcript_status text not null default 'pending' check (transcript_status in ('pending','fetched','unavailable','error')),
  transcript_fetched_at timestamptz,
  created_at timestamptz not null default now()
);

-- Generic suggestion box — designed so future use cases (risks, action
-- items, decisions) reuse this same table + review queue, not a new one each time.
create table public.agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  meeting_source_id uuid not null references public.meeting_sources(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('requirement')),  -- extend this list as new use cases are added
  origin text not null default 'agent' check (origin in ('agent','human_added')),  -- did the AI find this, or did a reviewer add it during triage?
  payload jsonb not null,          -- shape depends on suggestion_type; for 'requirement': {description, type, priority, process_code}
  original_payload jsonb,          -- snapshot of the agent's original extraction, kept even if the reviewer edits `payload` — audit trail of what changed
  supporting_quote text,           -- the transcript excerpt the suggestion was derived from (null for human_added), for reviewer trust + traceability
  confidence text check (confidence in ('high','medium','low')),
  was_edited boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  -- Every suggestion from one meeting is reviewed and committed together as
  -- a batch (see §5) — reviewed_by/reviewed_at/batch_id all get set at once
  -- when the admin clicks "Proceed", not per-row.
  batch_id uuid,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_entity_id uuid,          -- set to the real requirements.id once approved, for traceability
  created_at timestamptz not null default now()
);

-- Full governance trail — every agent action and every human decision, immutable.
create table public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_type text not null check (actor_type in ('agent','human')),
  actor_id uuid references public.profiles(id),   -- null when actor_type = 'agent'
  action text not null,             -- e.g. 'connection.created', 'transcript.fetched', 'suggestion.created', 'suggestion.approved'
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
```

RLS notes:
- `agent_connections`: visible/manageable only by the connecting admin and Super Admin — the *connection itself* (its tokens, its identity) stays private to whoever created it, even though the meetings it produces are reviewable by any project Admin.
- `meeting_sources` / `agent_suggestions`: any Admin on the project can view and act on these (see §8) — not restricted to the connecting admin. Still gated behind the elevated `'agent'` module permission, not the default project-member visibility.
- `agent_audit_log`: read-only for everyone except the writing process (service role); Super Admin can view, nobody can edit or delete — it's an audit trail, not a working table.

Also add one real table this plan assumes but doesn't yet exist in the current schema:
```sql
-- Promote the polymorphic `requirements` table's process-linked rows into a
-- first-class table if you want approved agent requirements to be
-- independently manageable (edit/delete) outside of the Scope page's
-- process-detail view. Otherwise, reuse the existing `requirements` table
-- (source_type='process', source_id=<process id the reviewer picks>) — no
-- schema change needed. Recommend starting with the existing table; only
-- split it out if agent-sourced requirements need their own list/workflow.
```

## 5. The One Use Case, End to End

1. Admin opens the new **"AI Agent"** sidebar page (new nav item, gated by the `agent` module permission — not inside the existing project Settings modal, since a Microsoft connection belongs to the admin's profile, not to any one project) and clicks **"Connect Microsoft Account"**.
   - That's a plain link to `/api/integrations/microsoft/connect` (a Route Handler, not a Server Action — OAuth needs a real browser redirect to Microsoft, which a Server Action can't do), which builds the authorization URL and sends them to `login.microsoftonline.com`.
   - Microsoft shows its own consent screen listing exactly the requested scopes (§3), admin accepts.
   - Microsoft redirects back to `/api/integrations/microsoft/callback?code=...`, another Route Handler that exchanges the code for tokens, fetches their Microsoft email, encrypts the refresh token, and **upserts** into `agent_connections` keyed by their profile (reconnecting replaces the old token, doesn't duplicate the row).
   - Back on the AI Agent page: "Connected as name@company.com".
2. Below the connection card (visible once connected), a **"Your Meetings"** list pulled live from Graph (`/me/calendarView`, filtered to `isOnlineMeeting: true`, a rolling window of roughly the last 7 days through the next 7 days). Each row shows subject/time/organizer and a status: **unlinked** → "Link to this project" button; **already linked** → shows which project, so the same meeting can't be silently double-linked. Clicking "Link to this project" writes a `meeting_sources` row immediately (`transcript_status = 'pending'`) — meetings never explicitly linked are never touched by the agent at all. (Open question, flag if you want it changed: a meeting can be linked to at most one project — mixed-attendee meetings spanning two engagements aren't split.)
3. A scheduled job (see §9) runs every N minutes, finds `meeting_sources` where `end_time < now()` and `transcript_status = 'pending'`, tries `GET /me/onlineMeetings/{id}/transcripts` via Graph using that meeting's connection's refreshed token.
4. Once a transcript is available: fetch it, send to Claude with a structured-output prompt ("extract candidate requirements discussed in this transcript; for each, give description/type/priority and the exact supporting quote"). Store each result as an `agent_suggestions` row (`status = 'pending'`, `origin = 'agent'`), all sharing one `batch_id` for that meeting. Log every step to `agent_audit_log`.
5. **Any Admin on the project** (not just the one who connected the account) opens the **Agent Review Queue** and sees this meeting's batch as a single checklist screen — say, 7 extracted rows, each showing its description and supporting quote, **all unchecked by default**:
   - Checks the ones that are actually valid (in the example, 5 of the 7).
   - Can edit any row's fields inline before it's committed (`payload` updated, `original_payload` keeps the agent's raw extraction, `was_edited = true`).
   - Can add an entirely new row the agent missed, typed manually (`origin = 'human_added'`, auto-checked since the admin just created it deliberately).
   - Clicks one **"Proceed"** button for the whole batch: every checked row gets `status = 'approved'` and a real row written to `requirements` (`created_entity_id` set); every unchecked row gets `status = 'rejected'`, no reason required. `reviewed_by`/`reviewed_at` are stamped on the whole batch at once. This single action is the *only* path by which agent output becomes real data — matching the "no exceptions" HITL decision.
6. The new requirements show up in Scope & BPM exactly like any manually-entered one — nothing downstream needs to know it came from a meeting, except the audit trail and each row's quiet link back to `created_entity_id`.

## 6. Token Security

- Refresh tokens are the most sensitive thing this feature stores — treat them like passwords, not like normal project data.
- Encrypt at rest using `pgcrypto`'s `pgp_sym_encrypt`, with the encryption key held in an environment variable (`AGENT_TOKEN_ENCRYPTION_KEY`), never in the database itself.
- Only server-side code (Server Actions / Route Handlers using the service role, never the anon key) should ever decrypt a token — RLS should prevent `agent_connections.encrypted_refresh_token` from being selectable by normal authenticated queries at all, even by the connecting admin's own session.
- Give the admin a visible, one-click **Disconnect** action (deletes the row, and calls Microsoft's revocation endpoint) — required both for good practice and for when someone leaves the company.

## 7. Open Design Question: Meeting-to-Project Linking

Two ways to solve "how does the agent know which project a meeting belongs to":

- **Manual tagging (recommended for v1)** — the admin explicitly links a calendar event to a project before/after it happens, via the "Link a Meeting" UI in §5. Zero false positives, simple to build, but requires a manual step.
- **Auto-suggest by attendee overlap** — match meeting attendees against `team_members` and suggest the project with the most overlap. Nice UX improvement, but risky to get wrong silently (a meeting with people from two different projects could get mis-tagged) — better as a v2 "suggested project, confirm or change" affordance layered on top of manual tagging, not a replacement for it.

## 8. RBAC Extension

The existing module enum (`dashboard`, `scope`, `kanban`, `resources`, `risks`, `settings`) doesn't have a natural home for this — add a new module, `'agent'`, with its own `can_view`/`can_edit`. Two different sensitivity tiers live under this one feature, and they get different treatment:

- **Reviewing meeting suggestions** (`meeting_sources`, `agent_suggestions`) — governed by the `'agent'` module permission like every other module. Default it into the seeded **Admin** role's permission matrix alongside the other five (view+edit), consistent with the confirmed "any project Admin can review" decision. **User** role gets no access, same pattern as `settings`.
- **The Microsoft connection itself** (`agent_connections`, and especially its encrypted token) — regardless of `'agent'` module permission, this stays visible/manageable only by the connecting admin and Super Admin, full stop. Being a project Admin who can review meeting suggestions does not imply you can see or use someone else's personal Microsoft account connection. This is a hard-coded RLS rule, not something the module permission matrix controls.

## 9. Background Processing

Next.js doesn't run long-lived background workers by itself. Two real options:

- **Polling cron (recommended for v1)** — a Route Handler (`/api/cron/poll-meetings`) that a scheduler hits every 5-10 minutes (Vercel Cron if deployed there, or any external scheduler hitting the URL with a shared secret). Simple, no extra infrastructure, good enough for "a few meetings a day" volume.
- **Microsoft Graph webhooks (change notifications)** — near-real-time instead of polling, but requires a publicly reachable HTTPS endpoint, subscription renewal logic (Graph subscriptions for this resource type expire and must be renewed well before ~70 minutes to a few hours depending on resource), and more error-handling surface. Worth it later if meeting volume or latency requirements grow; over-engineering for v1.

## 10. Phased Build Plan

1. **Azure AD app registration + OAuth connect flow** — admin can connect/see status/disconnect. No meeting logic yet. Prove tokens issue and refresh correctly.
2. **Calendar browsing + meeting-to-project linking UI** — list the admin's Teams meetings via Graph, link one to a project.
3. **Transcript fetch pipeline** — polling job detects ended, linked meetings and pulls the transcript when ready.
4. **LLM extraction** — transcript → Claude structured output → `agent_suggestions` rows, each with its supporting quote.
5. **HITL Review Queue UI** — per-meeting batch checklist (check / edit inline / add / Proceed), wired to a real `createRequirement` Server Action that runs once per checked row when the batch is committed, full audit logging.
6. **Governance hardening** — retention policy (e.g., purge raw transcript text after suggestions are generated — you don't need to keep the whole transcript once you've extracted what you need from it), audit log viewer, connection revocation, error alerting when extraction or token refresh fails silently.
7. **Generalize** (explicitly deferred) — once requirements extraction is trusted and used, add `suggestion_type = 'risk' | 'action_item' | 'decision'` following the exact same table/queue/approval pattern — this is why §4's schema is generic instead of requirement-specific.

## 11. Before Implementation Starts

- Check the bundled **claude-api** skill for current Anthropic API model names/structured-output patterns before writing the extraction code — same reason I checked Next.js's bundled docs before writing Next-specific code earlier in this project: assume training-data knowledge of API specifics is stale.
- Confirm with whoever owns compliance/legal at your org that meeting transcription + AI extraction is an acceptable use of meeting content under your existing recording/consent policy — this plan assumes yes, but it's not a decision I can make for you.
- Confirm Teams transcription is actually enabled for the connecting admin's meetings (org policy setting) before building the fetch pipeline — otherwise step 3 will just never find a transcript, which looks like a bug but isn't.
