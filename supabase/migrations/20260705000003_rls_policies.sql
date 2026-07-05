-- Row Level Security — the real enforcement boundary (plan.md §6), since
-- Supabase clients can call Postgres directly from the browser.

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create function public.is_super_admin() returns boolean as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$ language sql stable security definer set search_path = public;

create function public.is_project_member(p_project_id uuid) returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create function public.can_view_module(p_project_id uuid, p_module text) returns boolean as $$
  select public.is_super_admin() or exists (
    select 1
    from public.project_members pm
    join public.role_module_permissions rmp on rmp.role_id = pm.role_id
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
      and rmp.module = p_module and rmp.can_view
  );
$$ language sql stable security definer set search_path = public;

create function public.can_edit_module(p_project_id uuid, p_module text) returns boolean as $$
  select public.is_super_admin() or exists (
    select 1
    from public.project_members pm
    join public.role_module_permissions rmp on rmp.role_id = pm.role_id
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
      and rmp.module = p_module and rmp.can_edit
  );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- PROJECTS
-- ============================================================

alter table public.projects enable row level security;

create policy "projects_select" on public.projects for select
  using (public.is_super_admin() or public.is_project_member(id));

create policy "projects_insert" on public.projects for insert
  with check (public.is_super_admin());

create policy "projects_update" on public.projects for update
  using (public.can_edit_module(id, 'settings'))
  with check (public.can_edit_module(id, 'settings'));

create policy "projects_delete" on public.projects for delete
  using (public.is_super_admin());

-- ============================================================
-- Generic pattern for direct project-scoped tables:
--   select -> any project member (or super admin)
--   write  -> can_edit_module(project_id, '<module>')
-- ============================================================

-- DASHBOARD module: phases, gates, action_items
alter table public.phases enable row level security;
create policy "phases_select" on public.phases for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "phases_write" on public.phases for all using (public.can_edit_module(project_id, 'dashboard')) with check (public.can_edit_module(project_id, 'dashboard'));

alter table public.gates enable row level security;
create policy "gates_select" on public.gates for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "gates_write" on public.gates for all using (public.can_edit_module(project_id, 'dashboard')) with check (public.can_edit_module(project_id, 'dashboard'));

alter table public.action_items enable row level security;
create policy "action_items_select" on public.action_items for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "action_items_write" on public.action_items for all using (public.can_edit_module(project_id, 'dashboard')) with check (public.can_edit_module(project_id, 'dashboard'));

-- SCOPE module: processes, data_elements, requirements + join tables
alter table public.processes enable row level security;
create policy "processes_select" on public.processes for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "processes_write" on public.processes for all using (public.can_edit_module(project_id, 'scope')) with check (public.can_edit_module(project_id, 'scope'));

alter table public.data_elements enable row level security;
create policy "data_elements_select" on public.data_elements for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "data_elements_write" on public.data_elements for all using (public.can_edit_module(project_id, 'scope')) with check (public.can_edit_module(project_id, 'scope'));

alter table public.requirements enable row level security;
create policy "requirements_select" on public.requirements for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "requirements_write" on public.requirements for all using (public.can_edit_module(project_id, 'scope')) with check (public.can_edit_module(project_id, 'scope'));

alter table public.process_org_units enable row level security;
create policy "process_org_units_select" on public.process_org_units for select using (
  exists (select 1 from public.processes p where p.id = process_id and (public.is_project_member(p.project_id) or public.is_super_admin()))
);
create policy "process_org_units_write" on public.process_org_units for all using (
  exists (select 1 from public.processes p where p.id = process_id and public.can_edit_module(p.project_id, 'scope'))
) with check (
  exists (select 1 from public.processes p where p.id = process_id and public.can_edit_module(p.project_id, 'scope'))
);

alter table public.process_deps enable row level security;
create policy "process_deps_select" on public.process_deps for select using (
  exists (select 1 from public.processes p where p.id = process_id and (public.is_project_member(p.project_id) or public.is_super_admin()))
);
create policy "process_deps_write" on public.process_deps for all using (
  exists (select 1 from public.processes p where p.id = process_id and public.can_edit_module(p.project_id, 'scope'))
) with check (
  exists (select 1 from public.processes p where p.id = process_id and public.can_edit_module(p.project_id, 'scope'))
);

alter table public.data_element_process_links enable row level security;
create policy "de_process_links_select" on public.data_element_process_links for select using (
  exists (select 1 from public.data_elements d where d.id = data_element_id and (public.is_project_member(d.project_id) or public.is_super_admin()))
);
create policy "de_process_links_write" on public.data_element_process_links for all using (
  exists (select 1 from public.data_elements d where d.id = data_element_id and public.can_edit_module(d.project_id, 'scope'))
) with check (
  exists (select 1 from public.data_elements d where d.id = data_element_id and public.can_edit_module(d.project_id, 'scope'))
);

alter table public.data_element_org_units enable row level security;
create policy "de_org_units_select" on public.data_element_org_units for select using (
  exists (select 1 from public.data_elements d where d.id = data_element_id and (public.is_project_member(d.project_id) or public.is_super_admin()))
);
create policy "de_org_units_write" on public.data_element_org_units for all using (
  exists (select 1 from public.data_elements d where d.id = data_element_id and public.can_edit_module(d.project_id, 'scope'))
) with check (
  exists (select 1 from public.data_elements d where d.id = data_element_id and public.can_edit_module(d.project_id, 'scope'))
);

-- KANBAN module: columns, sprints, issues + join tables
alter table public.columns enable row level security;
create policy "columns_select" on public.columns for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "columns_write" on public.columns for all using (public.can_edit_module(project_id, 'kanban')) with check (public.can_edit_module(project_id, 'kanban'));

alter table public.sprints enable row level security;
create policy "sprints_select" on public.sprints for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "sprints_write" on public.sprints for all using (public.can_edit_module(project_id, 'kanban')) with check (public.can_edit_module(project_id, 'kanban'));

alter table public.issues enable row level security;
create policy "issues_select" on public.issues for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "issues_write" on public.issues for all using (public.can_edit_module(project_id, 'kanban')) with check (public.can_edit_module(project_id, 'kanban'));

alter table public.issue_effort_by_role enable row level security;
create policy "issue_effort_select" on public.issue_effort_by_role for select using (
  exists (select 1 from public.issues i where i.id = issue_id and (public.is_project_member(i.project_id) or public.is_super_admin()))
);
create policy "issue_effort_write" on public.issue_effort_by_role for all using (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
) with check (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
);

alter table public.issue_labels enable row level security;
create policy "issue_labels_select" on public.issue_labels for select using (
  exists (select 1 from public.issues i where i.id = issue_id and (public.is_project_member(i.project_id) or public.is_super_admin()))
);
create policy "issue_labels_write" on public.issue_labels for all using (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
) with check (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
);

alter table public.issue_links enable row level security;
create policy "issue_links_select" on public.issue_links for select using (
  exists (select 1 from public.issues i where i.id = issue_id and (public.is_project_member(i.project_id) or public.is_super_admin()))
);
create policy "issue_links_write" on public.issue_links for all using (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
) with check (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
);

-- Issue comments: any project member can add comments (not just editors) —
-- commenting isn't gated by the module edit permission in the source app.
alter table public.issue_comments enable row level security;
create policy "issue_comments_select" on public.issue_comments for select using (
  exists (select 1 from public.issues i where i.id = issue_id and (public.is_project_member(i.project_id) or public.is_super_admin()))
);
create policy "issue_comments_insert" on public.issue_comments for insert with check (
  exists (select 1 from public.issues i where i.id = issue_id and (public.is_project_member(i.project_id) or public.is_super_admin()))
);
create policy "issue_comments_delete" on public.issue_comments for delete using (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
);

alter table public.kanban_links enable row level security;
create policy "kanban_links_select" on public.kanban_links for select using (
  exists (select 1 from public.issues i where i.id = issue_id and (public.is_project_member(i.project_id) or public.is_super_admin()))
);
create policy "kanban_links_write" on public.kanban_links for all using (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
) with check (
  exists (select 1 from public.issues i where i.id = issue_id and public.can_edit_module(i.project_id, 'kanban'))
);

-- RESOURCES module: team_members, hours_log
alter table public.team_members enable row level security;
create policy "team_members_select" on public.team_members for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "team_members_write" on public.team_members for all using (public.can_edit_module(project_id, 'resources')) with check (public.can_edit_module(project_id, 'resources'));

alter table public.hours_log enable row level security;
create policy "hours_log_select" on public.hours_log for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "hours_log_write" on public.hours_log for all using (public.can_edit_module(project_id, 'resources')) with check (public.can_edit_module(project_id, 'resources'));

-- RISKS module: risks, issues_log
alter table public.risks enable row level security;
create policy "risks_select" on public.risks for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "risks_write" on public.risks for all using (public.can_edit_module(project_id, 'risks')) with check (public.can_edit_module(project_id, 'risks'));

alter table public.issues_log enable row level security;
create policy "issues_log_select" on public.issues_log for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "issues_log_write" on public.issues_log for all using (public.can_edit_module(project_id, 'risks')) with check (public.can_edit_module(project_id, 'risks'));

-- SETTINGS module: org_units (Settings -> Organization tab in the source app)
alter table public.org_units enable row level security;
create policy "org_units_select" on public.org_units for select using (public.is_project_member(project_id) or public.is_super_admin());
create policy "org_units_write" on public.org_units for all using (public.can_edit_module(project_id, 'settings')) with check (public.can_edit_module(project_id, 'settings'));

-- ============================================================
-- RBAC TABLES THEMSELVES
-- ============================================================

alter table public.profiles enable row level security;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin() or exists (
    -- project teammates can see each other's names for assignee pickers etc.
    select 1 from public.project_members my
    join public.project_members their on their.project_id = my.project_id
    where my.user_id = auth.uid() and their.user_id = profiles.id
  ));
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

alter table public.roles enable row level security;
create policy "roles_select_authenticated" on public.roles for select using (auth.uid() is not null);
create policy "roles_write_super_admin" on public.roles for all using (public.is_super_admin()) with check (public.is_super_admin());

alter table public.role_module_permissions enable row level security;
create policy "role_perms_select_authenticated" on public.role_module_permissions for select using (auth.uid() is not null);
create policy "role_perms_write_super_admin" on public.role_module_permissions for all using (public.is_super_admin()) with check (public.is_super_admin());

alter table public.project_members enable row level security;
create policy "project_members_select" on public.project_members for select
  using (public.is_super_admin() or public.is_project_member(project_id));
-- Super Admin manages membership anywhere; a project's own Admin can manage
-- membership for that project only (plan.md §10 — add-existing-user flow).
create policy "project_members_write" on public.project_members for all
  using (public.is_super_admin() or public.can_edit_module(project_id, 'settings'))
  with check (public.is_super_admin() or public.can_edit_module(project_id, 'settings'));

alter table public.invites enable row level security;
create policy "invites_select" on public.invites for select
  using (public.is_super_admin() or email = (auth.jwt() ->> 'email'));
create policy "invites_write_super_admin" on public.invites for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
-- The invited user updates their own invite row to 'accepted' once they set a password.
create policy "invites_accept_self" on public.invites for update
  using (email = (auth.jwt() ->> 'email') and status = 'pending')
  with check (email = (auth.jwt() ->> 'email') and status = 'accepted');
