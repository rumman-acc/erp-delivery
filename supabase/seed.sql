-- Demo dataset — the exact seed data from the source app / lib/seed-data.ts,
-- loaded into the normalized schema. Run automatically by `supabase db reset`
-- (local dev), or paste into the SQL editor of a real Supabase project once.
--
-- Pattern used throughout: stage raw rows into a temp table, insert into the
-- real table, then build a "ref" temp table (natural key -> generated uuid)
-- so later inserts can resolve foreign keys without hardcoding UUIDs.

begin;

create temporary table project_ref as
  select id as project_id from public.projects
  where false; -- typed empty shell; filled by the insert below

with new_project as (
  insert into public.projects (name, client, erp_system, go_live_date, issue_prefix, budget, issue_counter, de_counter, dr_counter)
  values ('D365 BC Implementation', 'Acme Corporation', 'D365 Business Central', '2026-12-31', 'ERP', 500000, 5, 4, 2)
  returning id
)
insert into project_ref select id from new_project;

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
create temporary table team_seed (code text, name text, role text, location text, planned_hours numeric, rate numeric, logged_hours numeric);
insert into team_seed values
  ('tm1', 'Sarah Chen', 'Project Manager', 'New York', 400, 180, 120),
  ('tm2', 'Marco Bianchi', 'Functional Consultant', 'London', 600, 150, 200),
  ('tm3', 'Priya Sharma', 'Technical Consultant', 'Bangalore', 500, 130, 160),
  ('tm4', 'James Wilson', 'Change Manager', 'New York', 200, 160, 40);

insert into public.team_members (project_id, name, role, location, planned_hours, rate, logged_hours)
select project_id, s.name, s.role, s.location, s.planned_hours, s.rate, s.logged_hours
from team_seed s, project_ref;

create temporary table team_ref as
select s.code, t.id, t.name
from team_seed s
join public.team_members t on t.name = s.name and t.project_id = (select project_id from project_ref);

-- ============================================================
-- ORG UNITS
-- ============================================================
create temporary table ou_seed (code text, location text, region text, strategic_bu text, business_unit text, type text, in_scope boolean);
insert into ou_seed values
  ('ou1', 'HQ New York', 'NA', 'Corporate', 'HQ', 'Headquarters', true),
  ('ou2', 'EMEA Hub Frankfurt', 'EMEA', 'Pharma', 'BU-A', 'Regional Office', true),
  ('ou3', 'Chicago Distribution', 'NA', 'Medical Device', 'BU-B', 'Distribution Center', true),
  ('ou4', 'São Paulo Office', 'LATAM', 'Consumer', 'BU-C', 'Sales Office', false);

insert into public.org_units (project_id, location, region, strategic_bu, business_unit, type, in_scope)
select project_id, s.location, s.region, s.strategic_bu, s.business_unit, s.type, s.in_scope
from ou_seed s, project_ref;

create temporary table ou_ref as
select s.code, o.id
from ou_seed s
join public.org_units o on o.location = s.location and o.project_id = (select project_id from project_ref);

-- ============================================================
-- PHASES
-- ============================================================
insert into public.phases (project_id, name, start_date, end_date, color, progress)
select project_id, v.name, v.start_date, v.end_date, v.color, v.progress
from project_ref, (values
  ('Discovery & Assessment', date '2026-01-05', date '2026-02-13', '#6366f1', 100),
  ('Blueprint & Design', date '2026-02-16', date '2026-04-10', '#3b82f6', 75),
  ('Build & Configure', date '2026-04-13', date '2026-08-14', '#f59e0b', 20),
  ('Testing & UAT', date '2026-08-17', date '2026-10-30', '#10b981', 0),
  ('Go-Live & Hypercare', date '2026-11-02', date '2026-12-31', '#ef4444', 0)
) as v(name, start_date, end_date, color, progress);

-- ============================================================
-- GATES (responsible looked up by team member name)
-- ============================================================
insert into public.gates (project_id, name, date, status, responsible_id, notes)
select project_ref.project_id, v.name, v.date, v.status, team_ref.id, v.notes
from project_ref, (values
  ('Project Kickoff', date '2026-01-07', 'green', 'Sarah Chen', 'Completed successfully'),
  ('Blueprint Sign-off', date '2026-04-10', 'amber', 'Marco Bianchi', '2 open items pending client approval'),
  ('Build Complete', date '2026-08-14', 'grey', 'Priya Sharma', ''),
  ('UAT Sign-off', date '2026-10-30', 'grey', 'Sarah Chen', ''),
  ('Go-Live Readiness', date '2026-12-01', 'grey', 'Sarah Chen', '')
) as v(name, date, status, responsible_name, notes)
join team_ref on team_ref.name = v.responsible_name;

-- ============================================================
-- ACTION ITEMS (owner looked up by team member name)
-- ============================================================
insert into public.action_items (project_id, title, owner_id, due_date, status, priority)
select project_ref.project_id, v.title, team_ref.id, v.due_date, v.status, v.priority
from project_ref, (values
  ('Confirm chart of accounts structure with CFO', 'Marco Bianchi', date '2026-07-15', 'Open', 'High'),
  ('Complete data migration mapping for customer master', 'Priya Sharma', date '2026-07-20', 'In Progress', 'High'),
  ('Schedule UAT kick-off workshop', 'Sarah Chen', date '2026-07-30', 'Open', 'Medium')
) as v(title, owner_name, due_date, status, priority)
join team_ref on team_ref.name = v.owner_name;

-- ============================================================
-- PROCESSES (two-pass: insert flat, then wire up parent_id by code)
-- ============================================================
create temporary table process_seed (code text, name text, level int, parent_code text, in_scope boolean, priority text, description text, notes text);
insert into process_seed values
  ('FI', 'Finance', 1, null, true, 'H', 'Financial accounting and reporting', ''),
  ('FI.1', 'General Ledger', 2, 'FI', true, 'H', '', ''),
  ('FI.1.1', 'Chart of Accounts', 3, 'FI.1', true, 'H', 'Design and maintain the CoA structure', 'Critical for all financial reporting'),
  ('FI.1.2', 'Journal Entries', 3, 'FI.1', true, 'H', '', ''),
  ('FI.1.3', 'Period Close', 3, 'FI.1', true, 'M', '', ''),
  ('FI.2', 'Accounts Payable', 2, 'FI', true, 'H', '', ''),
  ('FI.2.1', 'Vendor Master', 3, 'FI.2', true, 'H', '', ''),
  ('FI.2.2', 'Invoice Processing', 3, 'FI.2', true, 'H', '', ''),
  ('FI.2.3', 'Payment Runs', 3, 'FI.2', true, 'M', '', ''),
  ('FI.3', 'Accounts Receivable', 2, 'FI', true, 'H', '', ''),
  ('FI.3.1', 'Customer Master', 3, 'FI.3', true, 'H', '', ''),
  ('FI.3.2', 'Invoicing', 3, 'FI.3', true, 'H', '', ''),
  ('FI.3.3', 'Collections', 3, 'FI.3', true, 'M', '', ''),
  ('FI.4', 'Fixed Assets', 2, 'FI', true, 'M', '', ''),
  ('FI.4.1', 'Asset Master', 3, 'FI.4', true, 'M', '', ''),
  ('FI.4.2', 'Depreciation', 3, 'FI.4', true, 'M', '', ''),
  ('CO', 'Controlling', 1, null, true, 'H', 'Management accounting and cost controlling', ''),
  ('CO.1', 'Cost Centers', 2, 'CO', true, 'H', '', ''),
  ('CO.2', 'Profit Centers', 2, 'CO', true, 'H', '', ''),
  ('CO.3', 'Product Costing', 2, 'CO', true, 'M', '', ''),
  ('SCM', 'Supply Chain', 1, null, true, 'H', '', ''),
  ('SCM.1', 'Purchasing', 2, 'SCM', true, 'H', '', ''),
  ('SCM.1.1', 'Purchase Orders', 3, 'SCM.1', true, 'H', '', ''),
  ('SCM.1.2', 'Goods Receipt', 3, 'SCM.1', true, 'H', '', ''),
  ('SCM.2', 'Inventory Management', 2, 'SCM', true, 'H', '', ''),
  ('SCM.2.1', 'Warehouse Management', 3, 'SCM.2', true, 'H', '', ''),
  ('SCM.2.2', 'Physical Inventory', 3, 'SCM.2', true, 'M', '', ''),
  ('SCM.3', 'Demand Planning', 2, 'SCM', false, 'L', '', 'Out of scope for phase 1'),
  ('SD', 'Sales', 1, null, true, 'H', '', ''),
  ('SD.1', 'Order Management', 2, 'SD', true, 'H', '', ''),
  ('SD.1.1', 'Sales Orders', 3, 'SD.1', true, 'H', '', ''),
  ('SD.1.2', 'Quotations', 3, 'SD.1', true, 'M', '', ''),
  ('SD.2', 'Pricing', 2, 'SD', true, 'M', '', ''),
  ('HR', 'Human Resources', 1, null, false, 'L', '', 'Phase 2'),
  ('INT', 'Integration', 1, null, true, 'H', '', ''),
  ('INT.1', 'Data Migration', 2, 'INT', true, 'H', '', ''),
  ('INT.2', 'APIs & Middleware', 2, 'INT', true, 'M', '', ''),
  ('MDM', 'Master Data', 1, null, true, 'H', '', ''),
  ('MDM.1', 'Customer Master', 2, 'MDM', true, 'H', '', ''),
  ('MDM.2', 'Vendor Master', 2, 'MDM', true, 'H', '', ''),
  ('MDM.3', 'Item Master', 2, 'MDM', true, 'H', '', '');

insert into public.processes (project_id, code, name, level, in_scope, priority, description, notes)
select project_id, code, name, level, in_scope, priority, description, notes
from process_seed, project_ref;

create temporary table process_ref as
select s.code, p.id
from process_seed s
join public.processes p on p.code = s.code and p.project_id = (select project_id from project_ref);

update public.processes p
set parent_id = parent_ref.id
from process_seed s
join process_ref parent_ref on parent_ref.code = s.parent_code
where p.code = s.code and s.parent_code is not null and p.project_id = (select project_id from project_ref);

-- Process org unit links + the one process requirement in the seed data (FI.1.1)
insert into public.process_org_units (process_id, org_unit_id)
select pr.id, our.id
from (values ('FI.1.1', 'ou1'), ('FI.1.1', 'ou2')) as v(process_code, ou_code)
join process_ref pr on pr.code = v.process_code
join ou_ref our on our.code = v.ou_code;

insert into public.requirements (project_id, source_type, source_id, code, description, type, priority, status)
select project_ref.project_id, 'process', pr.id, 'REQ-001', 'Multi-company CoA with shared segments', 'Functional', 'H', 'Agreed'
from project_ref, process_ref pr where pr.code = 'FI.1.1';

-- ============================================================
-- DATA ELEMENTS
-- ============================================================
create temporary table de_seed (code text, name text, category text, description text, owner_name text, source_system text, target_system text, volume text, complexity text, in_scope boolean);
insert into de_seed values
  ('DE-001', 'Customer Master', 'Master Data', 'Core customer account data', 'Marco Bianchi', 'Legacy CRM', 'D365 BC', '~12,000 records', 'H', true),
  ('DE-002', 'Chart of Accounts', 'Configuration', 'GL account structure', 'Marco Bianchi', 'Excel', 'D365 BC', '~800 accounts', 'M', true),
  ('DE-003', 'Vendor Master', 'Master Data', 'Supplier master records', 'Priya Sharma', 'Legacy ERP', 'D365 BC', '~3,500 records', 'M', true),
  ('DE-004', 'Open AR Balance', 'Transactional', 'Outstanding accounts receivable at go-live', 'Marco Bianchi', 'Legacy ERP', 'D365 BC', '~45,000 items', 'H', true);

insert into public.data_elements (project_id, code, name, category, description, owner_id, source_system, target_system, volume, complexity, in_scope)
select project_ref.project_id, s.code, s.name, s.category, s.description, tr.id, s.source_system, s.target_system, s.volume, s.complexity, s.in_scope
from de_seed s
join team_ref tr on tr.name = s.owner_name, project_ref;

create temporary table de_ref as
select s.code, d.id
from de_seed s
join public.data_elements d on d.code = s.code and d.project_id = (select project_id from project_ref);

insert into public.data_element_process_links (data_element_id, process_id, direction)
select der.id, pr.id, v.direction
from (values
  ('DE-001', 'FI.3.1', 'Output'), ('DE-001', 'MDM.1', 'Both'),
  ('DE-002', 'FI.1.1', 'Both'),
  ('DE-003', 'FI.2.1', 'Output'), ('DE-003', 'MDM.2', 'Both'),
  ('DE-004', 'FI.3', 'Input')
) as v(de_code, process_code, direction)
join de_ref der on der.code = v.de_code
join process_ref pr on pr.code = v.process_code;

insert into public.data_element_org_units (data_element_id, org_unit_id)
select der.id, our.id
from (values
  ('DE-001', 'ou1'), ('DE-001', 'ou2'), ('DE-001', 'ou3'),
  ('DE-002', 'ou1'), ('DE-002', 'ou2'),
  ('DE-003', 'ou1'), ('DE-003', 'ou2'), ('DE-003', 'ou3'),
  ('DE-004', 'ou1'), ('DE-004', 'ou2'), ('DE-004', 'ou3')
) as v(de_code, ou_code)
join de_ref der on der.code = v.de_code
join ou_ref our on our.code = v.ou_code;

insert into public.requirements (project_id, source_type, source_id, code, description, type, priority, status, note)
select project_ref.project_id, 'data_element', der.id, v.code, v.description, v.type, v.priority, v.status, v.note
from project_ref, (values
  ('DE-001', 'DR-001', 'Cleanse duplicate customer records before migration', 'Cleansing', 'H', 'In Analysis', ''),
  ('DE-003', 'DR-002', 'Map legacy vendor categories to D365 BC vendor posting groups', 'Transformation', 'H', 'Open', '')
) as v(de_code, code, description, type, priority, status, note)
join de_ref der on der.code = v.de_code;

-- ============================================================
-- KANBAN COLUMNS & SPRINTS
-- ============================================================
create temporary table col_seed (code text, name text, color text, wip_limit int, sort_order int);
insert into col_seed values
  ('col-backlog', 'Backlog', '#6b7280', null, 0),
  ('col-todo', 'To Do', '#3b82f6', null, 1),
  ('col-inprogress', 'In Progress', '#f59e0b', 5, 2),
  ('col-review', 'In Review', '#8b5cf6', 3, 3),
  ('col-done', 'Done', '#10b981', null, 4);

insert into public.columns (project_id, name, color, wip_limit, sort_order)
select project_id, name, color, wip_limit, sort_order from col_seed, project_ref;

create temporary table col_ref as
select s.code, c.id
from col_seed s
join public.columns c on c.name = s.name and c.project_id = (select project_id from project_ref);

create temporary table sprint_seed (code text, name text, goal text, start_date date, end_date date, status text);
insert into sprint_seed values
  ('sp1', 'Sprint 1 — Foundation', 'Set up core financial structure and master data', date '2026-06-01', date '2026-06-28', 'active'),
  ('sp2', 'Sprint 2 — AP/AR', 'Configure accounts payable and receivable processes', date '2026-06-29', date '2026-07-26', 'planning');

insert into public.sprints (project_id, name, goal, start_date, end_date, status)
select project_id, name, goal, start_date, end_date, status from sprint_seed, project_ref;

create temporary table sprint_ref as
select s.code, sp.id
from sprint_seed s
join public.sprints sp on sp.name = s.name and sp.project_id = (select project_id from project_ref);

-- ============================================================
-- ISSUES (two-pass for self-referencing epic_id + lookups)
-- ============================================================
create temporary table issue_seed (
  key text, type text, title text, description text, priority text, col_code text,
  assignee_code text, epic_key text, sprint_code text, process_code text, epic_color text,
  created_at timestamptz, updated_at timestamptz
);
insert into issue_seed values
  ('ERP-001', 'Epic', 'Finance Module Implementation', 'End-to-end configuration of the Finance module including GL, AP, AR and FA', 'High', 'col-inprogress', 'tm2', null, 'sp1', 'FI.1', '#6366f1', '2026-06-01T08:00:00Z', '2026-06-10T09:00:00Z'),
  ('ERP-002', 'Story', 'Configure Chart of Accounts', 'Design and implement the multi-company chart of accounts structure aligned to client reporting requirements', 'High', 'col-inprogress', 'tm2', 'ERP-001', 'sp1', 'FI.1.1', null, '2026-06-02T08:00:00Z', '2026-06-15T10:00:00Z'),
  ('ERP-003', 'Task', 'Customer Master Data Cleansing', 'Analyze and cleanse ~12,000 customer records from legacy CRM for migration to D365 BC', 'Critical', 'col-todo', 'tm3', 'ERP-001', 'sp1', 'MDM.1', null, '2026-06-05T08:00:00Z', '2026-06-18T14:30:00Z'),
  ('ERP-004', 'Bug', 'AP Payment Run Generates Incorrect Amounts', 'Payment run batch is applying wrong exchange rate for EMEA vendors — needs investigation', 'Critical', 'col-review', 'tm3', 'ERP-001', 'sp1', 'FI.2.3', null, '2026-06-19T16:00:00Z', '2026-06-20T11:00:00Z'),
  ('ERP-005', 'Story', 'Configure Vendor Master & Posting Groups', 'Set up vendor master structure with posting groups aligned to AP process design', 'Medium', 'col-backlog', 'tm2', 'ERP-001', 'sp2', 'FI.2.1', null, '2026-06-10T08:00:00Z', '2026-06-10T08:00:00Z');

insert into public.issues (project_id, key, type, title, description, priority, status_column_id, assignee_id, sprint_id, process_link_id, epic_color, created_at, updated_at)
select project_ref.project_id, s.key, s.type, s.title, s.description, s.priority, cr.id, tr.id, sr.id, pr.id, s.epic_color, s.created_at, s.updated_at
from issue_seed s
join col_ref cr on cr.code = s.col_code
join team_ref tr on tr.code = s.assignee_code
left join sprint_ref sr on sr.code = s.sprint_code
left join process_ref pr on pr.code = s.process_code, project_ref;

create temporary table issue_ref as
select s.key, i.id
from issue_seed s
join public.issues i on i.key = s.key and i.project_id = (select project_id from project_ref);

update public.issues i
set epic_id = er.id
from issue_seed s
join issue_ref er on er.key = s.epic_key
where i.key = s.key and s.epic_key is not null and i.project_id = (select project_id from project_ref);

insert into public.issue_effort_by_role (issue_id, role, days)
select ir.id, v.role, v.days
from (values
  ('ERP-001', 'Project Manager', 5), ('ERP-001', 'Functional Consultant', 40), ('ERP-001', 'Technical Consultant', 10), ('ERP-001', 'Change Manager', 5),
  ('ERP-002', 'Project Manager', 1), ('ERP-002', 'Functional Consultant', 8), ('ERP-002', 'Technical Consultant', 2), ('ERP-002', 'Change Manager', 0),
  ('ERP-003', 'Project Manager', 0), ('ERP-003', 'Functional Consultant', 5), ('ERP-003', 'Technical Consultant', 15), ('ERP-003', 'Change Manager', 0),
  ('ERP-004', 'Project Manager', 0), ('ERP-004', 'Functional Consultant', 2), ('ERP-004', 'Technical Consultant', 8), ('ERP-004', 'Change Manager', 0),
  ('ERP-005', 'Project Manager', 0), ('ERP-005', 'Functional Consultant', 6), ('ERP-005', 'Technical Consultant', 3), ('ERP-005', 'Change Manager', 0)
) as v(issue_key, role, days)
join issue_ref ir on ir.key = v.issue_key;

insert into public.issue_labels (issue_id, label)
select ir.id, v.label
from (values
  ('ERP-001', 'Finance'), ('ERP-001', 'Core'),
  ('ERP-002', 'Finance'), ('ERP-002', 'GL'),
  ('ERP-003', 'Data Migration'), ('ERP-003', 'Master Data'),
  ('ERP-004', 'Finance'), ('ERP-004', 'AP'), ('ERP-004', 'Bug'),
  ('ERP-005', 'Finance'), ('ERP-005', 'AP'), ('ERP-005', 'Master Data')
) as v(issue_key, label)
join issue_ref ir on ir.key = v.issue_key;

insert into public.issue_links (issue_id, linked_issue_id, link_type)
select ir1.id, ir2.id, 'blocks'
from (values ('ERP-002', 'ERP-003')) as v(issue_key, blocks_key)
join issue_ref ir1 on ir1.key = v.issue_key
join issue_ref ir2 on ir2.key = v.blocks_key;

insert into public.issue_comments (issue_id, author_id, text, created_at)
select ir.id, tr.id, v.text, v.created_at::timestamptz
from (values
  ('ERP-001', 'Sarah Chen', 'Epic created — all finance sub-stories to be linked here', '2026-06-10T09:00:00Z'),
  ('ERP-003', 'Priya Sharma', 'Started analysis — ~800 duplicate records identified', '2026-06-18T14:30:00Z'),
  ('ERP-004', 'Marco Bianchi', 'Reproduced in test environment — looks like currency code mapping issue', '2026-06-20T11:00:00Z')
) as v(issue_key, author_name, text, created_at)
join issue_ref ir on ir.key = v.issue_key
join team_ref tr on tr.name = v.author_name;

insert into public.kanban_links (source_type, source_id, issue_id)
select 'process', pr.id, ir.id from (values ('FI.1', 'ERP-001')) as v(process_code, issue_key)
join process_ref pr on pr.code = v.process_code
join issue_ref ir on ir.key = v.issue_key
union all
select 'data_element', der.id, ir.id from (values ('DE-001', 'ERP-003')) as v(de_code, issue_key)
join de_ref der on der.code = v.de_code
join issue_ref ir on ir.key = v.issue_key;

-- ============================================================
-- RISKS & ISSUES LOG
-- ============================================================
insert into public.risks (project_id, code, description, category, probability, impact, mitigation, owner_id, status)
select project_ref.project_id, v.code, v.description, v.category, v.probability, v.impact, v.mitigation, tr.id, v.status
from project_ref, (values
  ('RSK-001', 'Key business stakeholders unavailable during UAT phase due to year-end close', 'Resource', 'H', 'H', 'Agree dedicated UAT windows with CFO; schedule early UAT planning session', 'Sarah Chen', 'Open'),
  ('RSK-002', 'Data quality in legacy system significantly worse than expected', 'Data', 'H', 'H', 'Accelerate data profiling; add buffer weeks in migration plan', 'Priya Sharma', 'Open'),
  ('RSK-003', 'Custom report requirements exceed standard D365 BC capabilities', 'Technical', 'M', 'M', 'Conduct early report requirements workshop; evaluate Power BI for complex reports', 'Marco Bianchi', 'Mitigated')
) as v(code, description, category, probability, impact, mitigation, owner_name, status)
join team_ref tr on tr.name = v.owner_name;

insert into public.issues_log (project_id, code, description, category, severity, root_cause, resolution, owner_id, due_date, status)
select project_ref.project_id, v.code, v.description, v.category, v.severity, v.root_cause, v.resolution, tr.id, v.due_date, v.status
from project_ref, (values
  ('ISS-001', 'Client delayed approval of blueprint document by 3 weeks', 'Governance', 'High', 'Internal client review process not aligned to project timeline', 'Escalated to Steering Committee — approval process expedited', 'Sarah Chen', date '2026-07-01', 'Resolved'),
  ('ISS-002', 'Integration middleware vendor not confirmed — delays API design', 'Technical', 'Medium', 'Procurement process still in progress at client', 'Proceed with API design based on REST standards; finalize vendor by sprint 2', 'Priya Sharma', date '2026-07-15', 'Open')
) as v(code, description, category, severity, root_cause, resolution, owner_name, due_date, status)
join team_ref tr on tr.name = v.owner_name;

-- ============================================================
-- HOURS LOG
-- ============================================================
insert into public.hours_log (project_id, date, team_member_id, hours, activity, notes)
select project_ref.project_id, v.date, tr.id, v.hours, v.activity, v.notes
from project_ref, (values
  (date '2026-06-20', 'Marco Bianchi', 8, 'Blueprint Workshop — Finance', 'CoA design session with CFO and controllers'),
  (date '2026-06-21', 'Priya Sharma', 6, 'Data Analysis — Customer Master', 'Profiling legacy CRM export'),
  (date '2026-06-22', 'Sarah Chen', 4, 'Project Management', 'Sprint planning, stakeholder updates')
) as v(date, person_name, hours, activity, notes)
join team_ref tr on tr.name = v.person_name;

commit;
