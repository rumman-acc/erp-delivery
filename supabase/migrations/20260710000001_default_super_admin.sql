-- Login is now Microsoft SSO only, gated to the accelance.io Azure AD
-- tenant (single-tenant app registration) — the tenant boundary is the
-- real access control now, so every new sign-in defaults to Super Admin.
-- A Super Admin can demote/promote anyone via Settings -> Users.
-- Existing profiles are untouched; this only changes the default for rows
-- inserted after this migration runs (via on_auth_user_created).
alter table public.profiles alter column is_super_admin set default true;
