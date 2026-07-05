-- Performance fix: getCurrentProject() was doing up to 4 sequential round
-- trips per page load (getUser, profile lookup, membership/id lookup,
-- project detail lookup). Collapse the DB side into one RPC call — combined
-- with switching getUser() -> getClaims() (local JWT verification) in
-- proxy.ts and lib/data/project.ts, this removes most of the fixed latency
-- on every single navigation.

create function public.get_my_current_project()
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
  where public.is_super_admin()
     or exists (
       select 1 from public.project_members pm
       where pm.project_id = p.id and pm.user_id = auth.uid()
     )
  order by (
    select pm.created_at from public.project_members pm
    where pm.project_id = p.id and pm.user_id = auth.uid()
  ) nulls last
  limit 1;
$$;

grant execute on function public.get_my_current_project() to authenticated;
