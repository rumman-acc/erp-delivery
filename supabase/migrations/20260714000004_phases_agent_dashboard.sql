-- Three independent changes bundled together:
--
-- 1. Phases can now be created without a timeline (default phases are
--    seeded with no dates — "Not scheduled" until someone sets real dates).
--
-- 2. AI Agent becomes a global, non-project-specific page — a project-scoped
--    can_view_module/can_edit_module check doesn't make sense for "should the
--    AI Agent nav item show at all," since that now depends on whether the
--    caller has agent access on ANY project, not one specific one.
--
-- 3. Main Dashboard (the /projects page) needs aggregate per-project stats
--    (open issues/risks) without N+1 round trips from the app.

alter table public.phases alter column start_date drop not null;
alter table public.phases alter column end_date drop not null;

create function public.can_view_agent_any_project() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.project_members pm
    join public.role_module_permissions rmp on rmp.role_id = pm.role_id
    where pm.user_id = auth.uid() and rmp.module = 'agent' and rmp.can_view
  );
$$;

grant execute on function public.can_view_agent_any_project() to authenticated;

create function public.get_my_project_stats()
returns table (
  project_id uuid,
  total_issues bigint,
  open_issues bigint,
  total_risks bigint,
  open_risks bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as project_id,
    (select count(*) from public.issues i where i.project_id = p.id) as total_issues,
    (select count(*) from public.issues i
       join public.columns c on c.id = i.status_column_id
       where i.project_id = p.id and c.name <> 'Done') as open_issues,
    (select count(*) from public.risks r where r.project_id = p.id) as total_risks,
    (select count(*) from public.risks r where r.project_id = p.id and r.status = 'Open') as open_risks
  from public.projects p
  where public.is_super_admin()
     or exists (
       select 1 from public.project_members pm
       where pm.project_id = p.id and pm.user_id = auth.uid()
     );
$$;

grant execute on function public.get_my_project_stats() to authenticated;
