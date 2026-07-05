-- Agentify Phase 1+ schema (see plan-agentic.md). Adds the 'agent' RBAC
-- module and the four tables backing the Teams/Outlook meeting-to-data
-- pipeline. RLS enforces two distinct sensitivity tiers per plan-agentic.md
-- §8: the Microsoft connection itself is private to its owner + Super Admin,
-- while the meetings/suggestions it produces are reviewable by any project Admin.

-- ============================================================
-- RBAC: add the 'agent' module
-- ============================================================
alter table public.role_module_permissions drop constraint role_module_permissions_module_check;
alter table public.role_module_permissions add constraint role_module_permissions_module_check
  check (module = any (array['dashboard','scope','kanban','resources','risks','settings','agent']));

insert into public.role_module_permissions (role_id, module, can_view, can_edit)
select r.id, 'agent', true, true from public.roles r where r.name = 'Admin';

insert into public.role_module_permissions (role_id, module, can_view, can_edit)
select r.id, 'agent', false, false from public.roles r where r.name = 'User';

-- ============================================================
-- CORE TABLES
-- ============================================================

-- One row per connected Microsoft account, per admin (not a singleton —
-- see plan-agentic.md §4). The connection is tied to a profile, not a
-- project: the same admin's one Outlook account can source meetings for
-- any project they're an Admin on.
create table public.agent_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by uuid not null unique references public.profiles(id) on delete cascade,
  microsoft_user_id text not null,
  microsoft_email text not null,
  encrypted_refresh_token text not null,   -- AES-256-GCM via lib/crypto.ts, base64 — see plan §6
  scopes text[] not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);

-- A calendar/Teams meeting explicitly linked to a project (manual link, not
-- auto-matched — plan §7).
create table public.meeting_sources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.agent_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  graph_event_id text not null,
  graph_meeting_id text,
  subject text not null,
  organizer_email text,
  start_time timestamptz not null,
  end_time timestamptz,
  linked_by uuid references public.profiles(id),
  transcript_status text not null default 'pending' check (transcript_status in ('pending', 'fetched', 'unavailable', 'error')),
  transcript_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, graph_event_id)
);

-- Generic suggestion box — designed so future use cases (risks, action
-- items, decisions) reuse this same table + review queue (plan §10 step 7).
create table public.agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  meeting_source_id uuid not null references public.meeting_sources(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('requirement')),
  origin text not null default 'agent' check (origin in ('agent', 'human_added')),
  payload jsonb not null,
  original_payload jsonb,
  supporting_quote text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  was_edited boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  batch_id uuid,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_entity_id uuid,
  created_at timestamptz not null default now()
);

-- Full governance trail — every agent action and every human decision, immutable.
create table public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_type text not null check (actor_type in ('agent', 'human')),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

-- agent_connections: hard-coded to the owner + Super Admin, regardless of
-- the 'agent' module permission — a project Admin who can review meeting
-- suggestions does NOT automatically get to see or use someone else's
-- personal Microsoft connection (plan §8).
alter table public.agent_connections enable row level security;

create policy "agent_connections_select" on public.agent_connections for select
  using (connected_by = auth.uid() or public.is_super_admin());
create policy "agent_connections_insert" on public.agent_connections for insert
  with check (connected_by = auth.uid());
create policy "agent_connections_update" on public.agent_connections for update
  using (connected_by = auth.uid() or public.is_super_admin())
  with check (connected_by = auth.uid() or public.is_super_admin());
create policy "agent_connections_delete" on public.agent_connections for delete
  using (connected_by = auth.uid() or public.is_super_admin());

-- meeting_sources / agent_suggestions: gated by the 'agent' module
-- permission like every other module — any project Admin, not just the
-- connecting admin.
alter table public.meeting_sources enable row level security;

create policy "meeting_sources_select" on public.meeting_sources for select
  using (public.can_view_module(project_id, 'agent'));
create policy "meeting_sources_write" on public.meeting_sources for all
  using (public.can_edit_module(project_id, 'agent'))
  with check (public.can_edit_module(project_id, 'agent'));

alter table public.agent_suggestions enable row level security;

create policy "agent_suggestions_select" on public.agent_suggestions for select
  using (public.can_view_module(project_id, 'agent'));
create policy "agent_suggestions_write" on public.agent_suggestions for all
  using (public.can_edit_module(project_id, 'agent'))
  with check (public.can_edit_module(project_id, 'agent'));

-- agent_audit_log: read-only audit trail. Any authenticated user can log an
-- action attributed to themselves (actor_type='human', actor_id=auth.uid());
-- agent-attributed rows (actor_type='agent') are written by trusted backend
-- jobs using the service role, which bypasses RLS entirely — no policy
-- needed for that path. Only Super Admin can read the log; nobody can
-- update or delete it.
alter table public.agent_audit_log enable row level security;

create policy "agent_audit_log_select" on public.agent_audit_log for select
  using (public.is_super_admin());
create policy "agent_audit_log_insert" on public.agent_audit_log for insert
  with check (actor_type = 'human' and actor_id = auth.uid());
