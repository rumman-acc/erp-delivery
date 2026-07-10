-- Phase 7 generalization (plan-agentic.md §10 step 7): agent_suggestions was
-- restricted to 'requirement' only. Widen it so one extraction pass can
-- classify a meeting's content into requirements, brand-new processes,
-- action items (including resourcing asks), risks, and issues — same
-- table/queue/approval pattern, just more destination types.
alter table public.agent_suggestions drop constraint agent_suggestions_suggestion_type_check;
alter table public.agent_suggestions add constraint agent_suggestions_suggestion_type_check
  check (suggestion_type in ('requirement', 'new_process', 'action_item', 'risk', 'issue'));
