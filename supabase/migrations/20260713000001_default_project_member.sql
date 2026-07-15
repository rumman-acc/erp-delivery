-- Every accelance.io sign-in already defaults to Super Admin (see
-- 20260710000001_default_super_admin.sql), which alone grants full access
-- to every project via the is_super_admin() bypass in can_view_module /
-- can_edit_module / get_my_current_project(). But that leaves membership
-- implicit, which makes project selection non-deterministic once a second
-- project exists (get_my_current_project() has nothing to order by for a
-- super admin with no project_members row). Make new signups explicit
-- Admin members of every existing project too, so membership and access
-- levels agree.
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into public.project_members (project_id, user_id, role_id)
  select p.id, new.id, r.id
  from public.projects p
  cross join public.roles r
  where r.name = 'Admin';

  return new;
end;
$$ language plpgsql security definer set search_path = public;
