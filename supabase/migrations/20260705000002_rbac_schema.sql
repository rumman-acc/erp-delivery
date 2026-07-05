-- RBAC schema (plan.md §6): one global Super Admin tier + per-project
-- Admin/User/dynamic roles with module-level view/edit permissions.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created (invite
-- acceptance or direct signup both fire this).
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_system boolean not null default false,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.role_module_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  module text not null check (module in ('dashboard', 'scope', 'kanban', 'resources', 'risks', 'settings')),
  can_view boolean not null default true,
  can_edit boolean not null default false,
  primary key (role_id, module)
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  invited_by uuid references public.profiles(id) on delete set null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Seed the two system roles and the default permission matrix (plan.md §6).
insert into public.roles (name, is_system, description) values
  ('Admin', true, 'Full CRUD on all modules within assigned project(s)'),
  ('User', true, 'View-only on all modules within assigned project(s)');

insert into public.role_module_permissions (role_id, module, can_view, can_edit)
select r.id, m.module, true, true
from public.roles r
cross join (values ('dashboard'), ('scope'), ('kanban'), ('resources'), ('risks'), ('settings')) as m(module)
where r.name = 'Admin';

insert into public.role_module_permissions (role_id, module, can_view, can_edit)
select r.id, m.module, true, false
from public.roles r
cross join (values ('dashboard'), ('scope'), ('kanban'), ('resources'), ('risks')) as m(module)
where r.name = 'User';

insert into public.role_module_permissions (role_id, module, can_view, can_edit)
select r.id, 'settings', false, false
from public.roles r
where r.name = 'User';
