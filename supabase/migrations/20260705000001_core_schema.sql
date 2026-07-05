-- Core domain schema — maps 1:1 to the source app's localStorage object
-- (plan.md §3), normalized and made multi-project (plan.md §5).

create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  erp_system text,
  go_live_date date,
  issue_prefix text not null default 'ERP',
  budget numeric not null default 0,
  issue_counter int not null default 0,
  de_counter int not null default 0,
  dr_counter int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- optional: only set if this team member also has a login
  name text not null,
  role text not null,
  location text,
  planned_hours numeric not null default 0,
  rate numeric not null default 0,
  logged_hours numeric not null default 0
);

create table public.org_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location text not null,
  region text,
  strategic_bu text,
  business_unit text,
  type text,
  in_scope boolean not null default true
);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  color text,
  progress int not null default 0 check (progress between 0 and 100)
);

create table public.gates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  date date,
  status text not null default 'grey' check (status in ('green', 'amber', 'red', 'grey')),
  responsible_id uuid references public.team_members(id) on delete set null,
  notes text
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  owner_id uuid references public.team_members(id) on delete set null,
  due_date date,
  status text not null default 'Open',
  priority text check (priority in ('Critical', 'High', 'Medium', 'Low'))
);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null, -- human-readable id, e.g. 'FI.1.1' (matches source)
  name text not null,
  level int not null check (level in (1, 2, 3)),
  parent_id uuid references public.processes(id) on delete cascade,
  in_scope boolean not null default true,
  priority text check (priority in ('H', 'M', 'L')),
  description text,
  notes text,
  unique (project_id, code)
);

create table public.process_org_units (
  process_id uuid not null references public.processes(id) on delete cascade,
  org_unit_id uuid not null references public.org_units(id) on delete cascade,
  primary key (process_id, org_unit_id)
);

create table public.process_deps (
  process_id uuid not null references public.processes(id) on delete cascade,
  depends_on_process_id uuid not null references public.processes(id) on delete cascade,
  primary key (process_id, depends_on_process_id)
);

create table public.data_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null, -- e.g. 'DE-001'
  name text not null,
  category text,
  description text,
  owner_id uuid references public.team_members(id) on delete set null,
  source_system text,
  target_system text,
  volume text,
  complexity text check (complexity in ('H', 'M', 'L')),
  in_scope boolean not null default true,
  unique (project_id, code)
);

create table public.data_element_process_links (
  data_element_id uuid not null references public.data_elements(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  direction text check (direction in ('Input', 'Output', 'Both')),
  primary key (data_element_id, process_id)
);

create table public.data_element_org_units (
  data_element_id uuid not null references public.data_elements(id) on delete cascade,
  org_unit_id uuid not null references public.org_units(id) on delete cascade,
  primary key (data_element_id, org_unit_id)
);

-- Shared by both processes and data elements (source_type discriminates),
-- since their requirement shapes overlap almost entirely (plan.md §5 notes).
create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('process', 'data_element')),
  source_id uuid not null,
  code text, -- e.g. 'REQ-001' / 'DR-001'
  description text not null,
  type text,
  priority text,
  status text,
  note text
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text,
  wip_limit int,
  sort_order int not null default 0
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  goal text,
  start_date date,
  end_date date,
  status text not null default 'planning'
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null, -- e.g. 'ERP-001'
  type text not null check (type in ('Epic', 'Story', 'Task', 'Bug', 'Sub-task')),
  title text not null,
  description text,
  priority text check (priority in ('Critical', 'High', 'Medium', 'Low')),
  status_column_id uuid references public.columns(id) on delete set null,
  assignee_id uuid references public.team_members(id) on delete set null,
  epic_id uuid references public.issues(id) on delete set null,
  sprint_id uuid references public.sprints(id) on delete set null,
  process_link_id uuid references public.processes(id) on delete set null,
  epic_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create table public.issue_effort_by_role (
  issue_id uuid not null references public.issues(id) on delete cascade,
  role text not null,
  days numeric not null default 0,
  primary key (issue_id, role)
);

create table public.issue_labels (
  issue_id uuid not null references public.issues(id) on delete cascade,
  label text not null,
  primary key (issue_id, label)
);

create table public.issue_links (
  issue_id uuid not null references public.issues(id) on delete cascade,
  linked_issue_id uuid not null references public.issues(id) on delete cascade,
  link_type text not null check (link_type in ('blocks', 'blocked_by')),
  primary key (issue_id, linked_issue_id, link_type)
);

create table public.issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  author_id uuid references public.team_members(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text, -- e.g. 'RSK-001'
  description text not null,
  category text,
  probability text check (probability in ('H', 'M', 'L')),
  impact text check (impact in ('H', 'M', 'L')),
  mitigation text,
  owner_id uuid references public.team_members(id) on delete set null,
  status text not null default 'Open'
);

create table public.issues_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text, -- e.g. 'ISS-001'
  description text not null,
  category text,
  severity text,
  root_cause text,
  resolution text,
  owner_id uuid references public.team_members(id) on delete set null,
  due_date date,
  status text not null default 'Open'
);

create table public.hours_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  team_member_id uuid references public.team_members(id) on delete set null,
  hours numeric not null,
  activity text,
  notes text
);

create table public.kanban_links (
  source_type text not null check (source_type in ('process', 'data_element')),
  source_id uuid not null,
  issue_id uuid not null references public.issues(id) on delete cascade,
  primary key (source_type, source_id, issue_id)
);

-- Keep updated_at current on the two tables that carry it.
create function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.issues
  for each row execute function public.set_updated_at();
