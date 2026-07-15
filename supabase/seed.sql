-- Real dataset for the Accelance Internal Tracking deployment (separate
-- Supabase project from the original ERP Delivery POC demo). Run
-- automatically by `supabase db reset` (local dev), or paste into the SQL
-- editor of the new Supabase project once, after migrations have run.
--
-- Scope tracked here: the 5 real projects + the shared team roster (anyone
-- can work on any project, so every person gets a team_members row per
-- project) + default Kanban columns so each project's board is usable
-- immediately + default delivery-lifecycle phases (no dates — "Not
-- scheduled" until an admin sets a real timeline). No fabricated
-- gates/risks/issues — those get entered for real through the UI or the
-- meeting-agent pipeline as work happens.
--
-- Pattern: stage raw rows into a temp table, insert into the real table,
-- then build a "ref" temp table (natural key -> generated uuid) so later
-- inserts can resolve foreign keys without hardcoding UUIDs.

begin;

-- ============================================================
-- PROJECTS
-- ============================================================
create temporary table project_seed (code text, name text, issue_prefix text);
insert into project_seed (code, name, issue_prefix) values
  ('aip',  'Accelance AI Platform', 'AIP'),
  ('erp',  'ERP Tracking',          'ERP'),
  ('scpi', 'SCP Internal',          'SCPI'),
  ('vms',  'VMS PMI',               'VMS'),
  ('scpa', 'SCP Agentification',    'SCPA');

insert into public.projects (name, client, budget, issue_prefix)
select name, 'Accelance', 0, issue_prefix from project_seed;

create temporary table project_ref as
select s.code, p.id as project_id
from project_seed s
join public.projects p on p.name = s.name;

-- ============================================================
-- TEAM ROSTER — shared across all projects (anyone can work on any project),
-- so each person gets one team_members row per project. No budget/rate
-- tracking yet (rate = 0), planned/logged hours start at 0.
-- ============================================================
create temporary table team_seed (name text, role text);
insert into team_seed (name, role) values
  ('Vijay',    'Delivery Head'),
  ('Pushpa',   'Business Analyst'),
  ('Narender', 'Senior Architect'),
  ('Haneeth',  'Business Analyst'),
  ('Rumman',   'Full Stack Developer'),
  ('Vikas',    'Full Stack Developer'),
  ('Dhanraj',  'Full Stack Developer');

insert into public.team_members (project_id, name, role, planned_hours, rate, logged_hours)
select pr.project_id, t.name, t.role, 0, 0, 0
from project_ref pr
cross join team_seed t;

-- ============================================================
-- KANBAN COLUMNS — same default board shape for every project.
-- ============================================================
create temporary table col_seed (name text, color text, wip_limit int, sort_order int);
insert into col_seed (name, color, wip_limit, sort_order) values
  ('Backlog',     '#6b7280', null, 0),
  ('To Do',       '#3b82f6', null, 1),
  ('In Progress', '#f59e0b', 5,    2),
  ('In Review',   '#8b5cf6', 3,    3),
  ('Done',        '#10b981', null, 4);

insert into public.columns (project_id, name, color, wip_limit, sort_order)
select pr.project_id, c.name, c.color, c.wip_limit, c.sort_order
from project_ref pr
cross join col_seed c;

-- ============================================================
-- DEFAULT PHASES — generic delivery lifecycle, no dates yet.
-- ============================================================
create temporary table phase_seed (name text, color text);
insert into phase_seed (name, color) values
  ('Discovery & Planning',      '#6366f1'),
  ('Design',                    '#3b82f6'),
  ('Development',               '#f59e0b'),
  ('Testing & QA',              '#10b981'),
  ('Deployment / Go-Live',      '#ef4444'),
  ('Support & Stabilization',   '#8b5cf6');

insert into public.phases (project_id, name, color, progress)
select pr.project_id, p.name, p.color, 0
from project_ref pr
cross join phase_seed p;

commit;
