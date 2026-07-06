-- Needed to resolve a calendar event into an actual Microsoft Graph online
-- meeting ID later (plan-agentic.md Phase 3) via
-- GET /me/onlineMeetings?$filter=JoinWebUrl eq '{join_url}'
alter table public.meeting_sources add column join_url text;
