-- A single meeting (e.g. a daily standup) can cover multiple projects at
-- once — the previous design forced one meeting_sources row to exactly one
-- project. This replaces that single project_id with a many-to-many join
-- table: one meeting_sources row per real calendar event, linked to
-- however many projects it's actually about.
--
-- agent_suggestions.project_id stays, but its meaning changes: it's now
-- Claude's best-guess (or the reviewer's corrected choice) of WHICH of the
-- meeting's linked projects a given suggestion belongs to — extraction
-- happens once per meeting, and each suggestion is individually tagged,
-- rather than the whole batch being duplicated per linked project.

create table public.meeting_source_projects (
  meeting_source_id uuid not null references public.meeting_sources(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  linked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (meeting_source_id, project_id)
);

-- Carry forward every existing single-project link as this meeting's one
-- (so far) linked project.
insert into public.meeting_source_projects (meeting_source_id, project_id, linked_by, created_at)
select id, project_id, linked_by, created_at from public.meeting_sources;

drop policy "meeting_sources_select" on public.meeting_sources;
drop policy "meeting_sources_write" on public.meeting_sources;

alter table public.meeting_sources drop column project_id;

-- Insert: only the connecting admin can create a meeting_sources row for
-- their own connection — it starts with zero linked projects (added right
-- after, in the same request, via meeting_source_projects_insert below), so
-- there's nothing project-scoped to check yet.
create policy "meeting_sources_insert" on public.meeting_sources for insert
  with check (exists (
    select 1 from public.agent_connections ac
    where ac.id = connection_id and ac.connected_by = auth.uid()
  ));

-- Select: visible once linked to at least one project the caller can view
-- agent data for. No separate update/delete policy — transcript-status
-- updates happen via the service role (pollMeetings, bypasses RLS
-- entirely) and nothing else mutates a meeting_sources row's own columns.
create policy "meeting_sources_select" on public.meeting_sources for select
  using (exists (
    select 1 from public.meeting_source_projects msp
    where msp.meeting_source_id = meeting_sources.id and public.can_view_module(msp.project_id, 'agent')
  ));

alter table public.meeting_source_projects enable row level security;

create policy "meeting_source_projects_select" on public.meeting_source_projects for select
  using (public.can_view_module(project_id, 'agent'));
create policy "meeting_source_projects_insert" on public.meeting_source_projects for insert
  with check (public.can_edit_module(project_id, 'agent'));
create policy "meeting_source_projects_delete" on public.meeting_source_projects for delete
  using (public.can_edit_module(project_id, 'agent'));

-- agent_suggestions RLS now goes through the meeting's linked projects
-- (any of them), not the suggestion's own project_id tag directly — a
-- suggestion tagged to Project A must still be visible/reassignable by an
-- Admin of Project B if this meeting is linked to both. The WITH CHECK
-- additionally requires the tag itself to be one of the meeting's actually
-- linked projects, so a reviewer can't redirect a suggestion to an
-- unrelated project nobody linked this meeting to.
drop policy "agent_suggestions_select" on public.agent_suggestions;
drop policy "agent_suggestions_write" on public.agent_suggestions;

create policy "agent_suggestions_select" on public.agent_suggestions for select
  using (exists (
    select 1 from public.meeting_source_projects msp
    where msp.meeting_source_id = agent_suggestions.meeting_source_id
      and public.can_view_module(msp.project_id, 'agent')
  ));

create policy "agent_suggestions_write" on public.agent_suggestions for all
  using (exists (
    select 1 from public.meeting_source_projects msp
    where msp.meeting_source_id = agent_suggestions.meeting_source_id
      and public.can_edit_module(msp.project_id, 'agent')
  ))
  with check (
    exists (
      select 1 from public.meeting_source_projects msp
      where msp.meeting_source_id = agent_suggestions.meeting_source_id
        and public.can_edit_module(msp.project_id, 'agent')
    )
    and exists (
      select 1 from public.meeting_source_projects msp2
      where msp2.meeting_source_id = agent_suggestions.meeting_source_id
        and msp2.project_id = agent_suggestions.project_id
    )
  );
