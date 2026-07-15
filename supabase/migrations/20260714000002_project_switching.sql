-- Multi-project UI support: there was previously no way to list every
-- project a user can access or switch between them (get_my_current_project
-- always picked exactly one, with no override). Adds:
--   1. get_my_projects() — list every accessible project (Projects page).
--   2. get_my_current_project(p_project_id) — same ordering/access rule as
--      before, but an explicit project id (from a cookie) wins when given
--      and accessible, keeping the "one DB round trip" property intact.
--   3. agent_suggestions gains a 'new_project' type, so the meeting agent
--      can propose an entirely new project (not just a new process within
--      the current one) for human approval.

create function public.get_my_projects()
returns table (
  id uuid,
  name text,
  client text,
  budget numeric,
  issue_prefix text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.client, p.budget, p.issue_prefix
  from public.projects p
  where public.is_super_admin()
     or exists (
       select 1 from public.project_members pm
       where pm.project_id = p.id and pm.user_id = auth.uid()
     )
  order by p.name;
$$;

grant execute on function public.get_my_projects() to authenticated;

create or replace function public.get_my_current_project(p_project_id uuid default null)
returns table (
  id uuid,
  name text,
  client text,
  erp_system text,
  go_live_date date,
  issue_prefix text,
  budget numeric,
  is_super_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.client, p.erp_system, p.go_live_date, p.issue_prefix, p.budget,
         public.is_super_admin() as is_super_admin
  from public.projects p
  where (
      public.is_super_admin()
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p.id and pm.user_id = auth.uid()
      )
    )
    and (p_project_id is null or p.id = p_project_id)
  order by (
    select pm.created_at from public.project_members pm
    where pm.project_id = p.id and pm.user_id = auth.uid()
  ) nulls last
  limit 1;
$$;

alter table public.agent_suggestions drop constraint agent_suggestions_suggestion_type_check;
alter table public.agent_suggestions add constraint agent_suggestions_suggestion_type_check
  check (suggestion_type in ('requirement', 'new_process', 'action_item', 'risk', 'issue', 'new_project'));

-- Issue keys are formed from a project's prefix (e.g. "AIP-001"); keep
-- prefixes distinct across projects so keys stay visually unambiguous, and
-- so both the manual "New Project" form and an approved new_project
-- suggestion can rely on a clean 23505 conflict instead of silently
-- colliding.
alter table public.projects add constraint projects_issue_prefix_key unique (issue_prefix);
