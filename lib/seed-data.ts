// Ported verbatim from the source app's App.State.init() default dataset.
// This is presentational seed data for the visual-parity build phase —
// it will be replaced by Supabase queries once the schema is wired (plan.md §9 step 3+).

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  location: string;
  plannedHours: number;
  rate: number;
  loggedHours: number;
};

export type OrgUnit = {
  id: string;
  location: string;
  region: string;
  strategicBU: string;
  businessUnit: string;
  type: string;
  inScope: boolean;
};

export type Phase = {
  id: string;
  name: string;
  start: string;
  end: string;
  color: string;
  progress: number;
};

export type Gate = {
  id: string;
  name: string;
  date: string;
  status: "green" | "amber" | "red" | "grey";
  responsible: string;
  notes: string;
};

export type ActionItem = {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: string;
  priority: "Critical" | "High" | "Medium" | "Low";
};

export type Requirement = {
  id: string;
  desc: string;
  type: string;
  priority: string;
  status: string;
  note?: string;
  kanbanIssue?: string | null;
  sprint?: string | null;
};

export type ProcessNode = {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
  inscope: boolean;
  priority: "H" | "M" | "L";
  description: string;
  notes: string;
  orgUnits: string[];
  requirements: Requirement[];
  processDeps: string[];
  dataDeps: string[];
  kanbanLinks: string[];
};

export type DataElement = {
  id: string;
  name: string;
  category: string;
  description: string;
  owner: string;
  source: string;
  target: string;
  volume: string;
  complexity: "H" | "M" | "L";
  inscope: boolean;
  linkedProcesses: { pid: string; direction: string }[];
  orgUnits: string[];
  requirements: Requirement[];
  kanbanLinks: string[];
};

export type KanbanColumn = {
  id: string;
  name: string;
  color: string;
  wipLimit: number | null;
  order: number;
};

export type Sprint = {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type Comment = { id: string; author: string; text: string; timestamp: string };

export type Issue = {
  id: string;
  type: "Epic" | "Story" | "Task" | "Bug" | "Sub-task";
  title: string;
  description: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: string;
  assignee: string;
  effortByRole: Record<string, number>;
  epic: string | null;
  sprint: string | null;
  labels: string[];
  processLink: string | null;
  blocks: string[];
  blockedBy: string[];
  comments: Comment[];
  epicColor?: string;
  created: string;
  updated: string;
};

export type Risk = {
  id: string;
  description: string;
  category: string;
  probability: "H" | "M" | "L";
  impact: "H" | "M" | "L";
  mitigation: string;
  owner: string;
  status: string;
};

export type IssueLogEntry = {
  id: string;
  description: string;
  category: string;
  severity: string;
  rootCause: string;
  resolution: string;
  owner: string;
  due: string;
  status: string;
};

export type HoursLogEntry = {
  id: string;
  date: string;
  person: string;
  hours: number;
  activity: string;
  notes: string;
};

export const config = {
  name: "D365 BC Implementation",
  client: "Acme Corporation",
  erp: "D365 Business Central",
  goLive: "2026-12-31",
  prefix: "ERP",
  budget: 500000,
  team: [
    { id: "tm1", name: "Sarah Chen", role: "Project Manager", location: "New York", plannedHours: 400, rate: 180, loggedHours: 120 },
    { id: "tm2", name: "Marco Bianchi", role: "Functional Consultant", location: "London", plannedHours: 600, rate: 150, loggedHours: 200 },
    { id: "tm3", name: "Priya Sharma", role: "Technical Consultant", location: "Bangalore", plannedHours: 500, rate: 130, loggedHours: 160 },
    { id: "tm4", name: "James Wilson", role: "Change Manager", location: "New York", plannedHours: 200, rate: 160, loggedHours: 40 },
  ] as TeamMember[],
  orgUnits: [
    { id: "ou1", location: "HQ New York", region: "NA", strategicBU: "Corporate", businessUnit: "HQ", type: "Headquarters", inScope: true },
    { id: "ou2", location: "EMEA Hub Frankfurt", region: "EMEA", strategicBU: "Pharma", businessUnit: "BU-A", type: "Regional Office", inScope: true },
    { id: "ou3", location: "Chicago Distribution", region: "NA", strategicBU: "Medical Device", businessUnit: "BU-B", type: "Distribution Center", inScope: true },
    { id: "ou4", location: "São Paulo Office", region: "LATAM", strategicBU: "Consumer", businessUnit: "BU-C", type: "Sales Office", inScope: false },
  ] as OrgUnit[],
};

export const phases: Phase[] = [
  { id: "ph1", name: "Discovery & Assessment", start: "2026-01-05", end: "2026-02-13", color: "#6366f1", progress: 100 },
  { id: "ph2", name: "Blueprint & Design", start: "2026-02-16", end: "2026-04-10", color: "#3b82f6", progress: 75 },
  { id: "ph3", name: "Build & Configure", start: "2026-04-13", end: "2026-08-14", color: "#f59e0b", progress: 20 },
  { id: "ph4", name: "Testing & UAT", start: "2026-08-17", end: "2026-10-30", color: "#10b981", progress: 0 },
  { id: "ph5", name: "Go-Live & Hypercare", start: "2026-11-02", end: "2026-12-31", color: "#ef4444", progress: 0 },
];

export const gates: Gate[] = [
  { id: "g1", name: "Project Kickoff", date: "2026-01-07", status: "green", responsible: "Sarah Chen", notes: "Completed successfully" },
  { id: "g2", name: "Blueprint Sign-off", date: "2026-04-10", status: "amber", responsible: "Marco Bianchi", notes: "2 open items pending client approval" },
  { id: "g3", name: "Build Complete", date: "2026-08-14", status: "grey", responsible: "Priya Sharma", notes: "" },
  { id: "g4", name: "UAT Sign-off", date: "2026-10-30", status: "grey", responsible: "Sarah Chen", notes: "" },
  { id: "g5", name: "Go-Live Readiness", date: "2026-12-01", status: "grey", responsible: "Sarah Chen", notes: "" },
];

export const actions: ActionItem[] = [
  { id: "a1", title: "Confirm chart of accounts structure with CFO", owner: "Marco Bianchi", due: "2026-07-15", status: "Open", priority: "High" },
  { id: "a2", title: "Complete data migration mapping for customer master", owner: "Priya Sharma", due: "2026-07-20", status: "In Progress", priority: "High" },
  { id: "a3", title: "Schedule UAT kick-off workshop", owner: "Sarah Chen", due: "2026-07-30", status: "Open", priority: "Medium" },
];

export const processes: ProcessNode[] = [
  { id: "FI", name: "Finance", level: 1, parent: null, inscope: true, priority: "H", description: "Financial accounting and reporting", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.1", name: "General Ledger", level: 2, parent: "FI", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: ["ERP-001"] },
  { id: "FI.1.1", name: "Chart of Accounts", level: 3, parent: "FI.1", inscope: true, priority: "H", description: "Design and maintain the CoA structure", notes: "Critical for all financial reporting", orgUnits: ["ou1", "ou2"], requirements: [{ id: "REQ-001", desc: "Multi-company CoA with shared segments", type: "Functional", priority: "H", status: "Agreed" }], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.1.2", name: "Journal Entries", level: 3, parent: "FI.1", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.1.3", name: "Period Close", level: 3, parent: "FI.1", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.2", name: "Accounts Payable", level: 2, parent: "FI", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.2.1", name: "Vendor Master", level: 3, parent: "FI.2", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.2.2", name: "Invoice Processing", level: 3, parent: "FI.2", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.2.3", name: "Payment Runs", level: 3, parent: "FI.2", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.3", name: "Accounts Receivable", level: 2, parent: "FI", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.3.1", name: "Customer Master", level: 3, parent: "FI.3", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.3.2", name: "Invoicing", level: 3, parent: "FI.3", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.3.3", name: "Collections", level: 3, parent: "FI.3", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.4", name: "Fixed Assets", level: 2, parent: "FI", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.4.1", name: "Asset Master", level: 3, parent: "FI.4", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "FI.4.2", name: "Depreciation", level: 3, parent: "FI.4", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "CO", name: "Controlling", level: 1, parent: null, inscope: true, priority: "H", description: "Management accounting and cost controlling", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "CO.1", name: "Cost Centers", level: 2, parent: "CO", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "CO.2", name: "Profit Centers", level: 2, parent: "CO", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "CO.3", name: "Product Costing", level: 2, parent: "CO", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM", name: "Supply Chain", level: 1, parent: null, inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.1", name: "Purchasing", level: 2, parent: "SCM", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.1.1", name: "Purchase Orders", level: 3, parent: "SCM.1", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.1.2", name: "Goods Receipt", level: 3, parent: "SCM.1", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.2", name: "Inventory Management", level: 2, parent: "SCM", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.2.1", name: "Warehouse Management", level: 3, parent: "SCM.2", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.2.2", name: "Physical Inventory", level: 3, parent: "SCM.2", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SCM.3", name: "Demand Planning", level: 2, parent: "SCM", inscope: false, priority: "L", description: "", notes: "Out of scope for phase 1", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SD", name: "Sales", level: 1, parent: null, inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SD.1", name: "Order Management", level: 2, parent: "SD", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SD.1.1", name: "Sales Orders", level: 3, parent: "SD.1", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SD.1.2", name: "Quotations", level: 3, parent: "SD.1", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "SD.2", name: "Pricing", level: 2, parent: "SD", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "HR", name: "Human Resources", level: 1, parent: null, inscope: false, priority: "L", description: "", notes: "Phase 2", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "INT", name: "Integration", level: 1, parent: null, inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "INT.1", name: "Data Migration", level: 2, parent: "INT", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "INT.2", name: "APIs & Middleware", level: 2, parent: "INT", inscope: true, priority: "M", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "MDM", name: "Master Data", level: 1, parent: null, inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "MDM.1", name: "Customer Master", level: 2, parent: "MDM", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "MDM.2", name: "Vendor Master", level: 2, parent: "MDM", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
  { id: "MDM.3", name: "Item Master", level: 2, parent: "MDM", inscope: true, priority: "H", description: "", notes: "", orgUnits: [], requirements: [], processDeps: [], dataDeps: [], kanbanLinks: [] },
];

export const dataElements: DataElement[] = [
  { id: "DE-001", name: "Customer Master", category: "Master Data", description: "Core customer account data", owner: "Marco Bianchi", source: "Legacy CRM", target: "D365 BC", volume: "~12,000 records", complexity: "H", inscope: true, linkedProcesses: [{ pid: "FI.3.1", direction: "Output" }, { pid: "MDM.1", direction: "Both" }], orgUnits: ["ou1", "ou2", "ou3"], requirements: [{ id: "DR-001", desc: "Cleanse duplicate customer records before migration", type: "Cleansing", priority: "H", status: "In Analysis", note: "", kanbanIssue: "ERP-003", sprint: "sp1" }], kanbanLinks: ["ERP-003"] },
  { id: "DE-002", name: "Chart of Accounts", category: "Configuration", description: "GL account structure", owner: "Marco Bianchi", source: "Excel", target: "D365 BC", volume: "~800 accounts", complexity: "M", inscope: true, linkedProcesses: [{ pid: "FI.1.1", direction: "Both" }], orgUnits: ["ou1", "ou2"], requirements: [], kanbanLinks: [] },
  { id: "DE-003", name: "Vendor Master", category: "Master Data", description: "Supplier master records", owner: "Priya Sharma", source: "Legacy ERP", target: "D365 BC", volume: "~3,500 records", complexity: "M", inscope: true, linkedProcesses: [{ pid: "FI.2.1", direction: "Output" }, { pid: "MDM.2", direction: "Both" }], orgUnits: ["ou1", "ou2", "ou3"], requirements: [{ id: "DR-002", desc: "Map legacy vendor categories to D365 BC vendor posting groups", type: "Transformation", priority: "H", status: "Open", note: "", kanbanIssue: null, sprint: null }], kanbanLinks: [] },
  { id: "DE-004", name: "Open AR Balance", category: "Transactional", description: "Outstanding accounts receivable at go-live", owner: "Marco Bianchi", source: "Legacy ERP", target: "D365 BC", volume: "~45,000 items", complexity: "H", inscope: true, linkedProcesses: [{ pid: "FI.3", direction: "Input" }], orgUnits: ["ou1", "ou2", "ou3"], requirements: [], kanbanLinks: [] },
];

export const columns: KanbanColumn[] = [
  { id: "col-backlog", name: "Backlog", color: "#6b7280", wipLimit: null, order: 0 },
  { id: "col-todo", name: "To Do", color: "#3b82f6", wipLimit: null, order: 1 },
  { id: "col-inprogress", name: "In Progress", color: "#f59e0b", wipLimit: 5, order: 2 },
  { id: "col-review", name: "In Review", color: "#8b5cf6", wipLimit: 3, order: 3 },
  { id: "col-done", name: "Done", color: "#10b981", wipLimit: null, order: 4 },
];

export const sprints: Sprint[] = [
  { id: "sp1", name: "Sprint 1 — Foundation", goal: "Set up core financial structure and master data", startDate: "2026-06-01", endDate: "2026-06-28", status: "active" },
  { id: "sp2", name: "Sprint 2 — AP/AR", goal: "Configure accounts payable and receivable processes", startDate: "2026-06-29", endDate: "2026-07-26", status: "planning" },
];

export const issues: Issue[] = [
  { id: "ERP-001", type: "Epic", title: "Finance Module Implementation", description: "End-to-end configuration of the Finance module including GL, AP, AR and FA", priority: "High", status: "col-inprogress", assignee: "tm2", effortByRole: { "Project Manager": 5, "Functional Consultant": 40, "Technical Consultant": 10, "Change Manager": 5 }, epic: null, sprint: "sp1", labels: ["Finance", "Core"], processLink: "FI.1", blocks: [], blockedBy: [], comments: [{ id: "c1", author: "Sarah Chen", text: "Epic created — all finance sub-stories to be linked here", timestamp: "2026-06-10T09:00:00Z" }], epicColor: "#6366f1", created: "2026-06-01T08:00:00Z", updated: "2026-06-10T09:00:00Z" },
  { id: "ERP-002", type: "Story", title: "Configure Chart of Accounts", description: "Design and implement the multi-company chart of accounts structure aligned to client reporting requirements", priority: "High", status: "col-inprogress", assignee: "tm2", effortByRole: { "Project Manager": 1, "Functional Consultant": 8, "Technical Consultant": 2, "Change Manager": 0 }, epic: "ERP-001", sprint: "sp1", labels: ["Finance", "GL"], processLink: "FI.1.1", blocks: ["ERP-003"], blockedBy: [], comments: [], created: "2026-06-02T08:00:00Z", updated: "2026-06-15T10:00:00Z" },
  { id: "ERP-003", type: "Task", title: "Customer Master Data Cleansing", description: "Analyze and cleanse ~12,000 customer records from legacy CRM for migration to D365 BC", priority: "Critical", status: "col-todo", assignee: "tm3", effortByRole: { "Project Manager": 0, "Functional Consultant": 5, "Technical Consultant": 15, "Change Manager": 0 }, epic: "ERP-001", sprint: "sp1", labels: ["Data Migration", "Master Data"], processLink: "MDM.1", blocks: [], blockedBy: ["ERP-002"], comments: [{ id: "c2", author: "Priya Sharma", text: "Started analysis — ~800 duplicate records identified", timestamp: "2026-06-18T14:30:00Z" }], created: "2026-06-05T08:00:00Z", updated: "2026-06-18T14:30:00Z" },
  { id: "ERP-004", type: "Bug", title: "AP Payment Run Generates Incorrect Amounts", description: "Payment run batch is applying wrong exchange rate for EMEA vendors — needs investigation", priority: "Critical", status: "col-review", assignee: "tm3", effortByRole: { "Project Manager": 0, "Functional Consultant": 2, "Technical Consultant": 8, "Change Manager": 0 }, epic: "ERP-001", sprint: "sp1", labels: ["Finance", "AP", "Bug"], processLink: "FI.2.3", blocks: [], blockedBy: [], comments: [{ id: "c3", author: "Marco Bianchi", text: "Reproduced in test environment — looks like currency code mapping issue", timestamp: "2026-06-20T11:00:00Z" }], created: "2026-06-19T16:00:00Z", updated: "2026-06-20T11:00:00Z" },
  { id: "ERP-005", type: "Story", title: "Configure Vendor Master & Posting Groups", description: "Set up vendor master structure with posting groups aligned to AP process design", priority: "Medium", status: "col-backlog", assignee: "tm2", effortByRole: { "Project Manager": 0, "Functional Consultant": 6, "Technical Consultant": 3, "Change Manager": 0 }, epic: "ERP-001", sprint: "sp2", labels: ["Finance", "AP", "Master Data"], processLink: "FI.2.1", blocks: [], blockedBy: [], comments: [], created: "2026-06-10T08:00:00Z", updated: "2026-06-10T08:00:00Z" },
];

export const risks: Risk[] = [
  { id: "RSK-001", description: "Key business stakeholders unavailable during UAT phase due to year-end close", category: "Resource", probability: "H", impact: "H", mitigation: "Agree dedicated UAT windows with CFO; schedule early UAT planning session", owner: "Sarah Chen", status: "Open" },
  { id: "RSK-002", description: "Data quality in legacy system significantly worse than expected", category: "Data", probability: "H", impact: "H", mitigation: "Accelerate data profiling; add buffer weeks in migration plan", owner: "Priya Sharma", status: "Open" },
  { id: "RSK-003", description: "Custom report requirements exceed standard D365 BC capabilities", category: "Technical", probability: "M", impact: "M", mitigation: "Conduct early report requirements workshop; evaluate Power BI for complex reports", owner: "Marco Bianchi", status: "Mitigated" },
];

export const issuesLog: IssueLogEntry[] = [
  { id: "ISS-001", description: "Client delayed approval of blueprint document by 3 weeks", category: "Governance", severity: "High", rootCause: "Internal client review process not aligned to project timeline", resolution: "Escalated to Steering Committee — approval process expedited", owner: "Sarah Chen", due: "2026-07-01", status: "Resolved" },
  { id: "ISS-002", description: "Integration middleware vendor not confirmed — delays API design", category: "Technical", severity: "Medium", rootCause: "Procurement process still in progress at client", resolution: "Proceed with API design based on REST standards; finalize vendor by sprint 2", owner: "Priya Sharma", due: "2026-07-15", status: "Open" },
];

export const hoursLog: HoursLogEntry[] = [
  { id: "hl1", date: "2026-06-20", person: "Marco Bianchi", hours: 8, activity: "Blueprint Workshop — Finance", notes: "CoA design session with CFO and controllers" },
  { id: "hl2", date: "2026-06-21", person: "Priya Sharma", hours: 6, activity: "Data Analysis — Customer Master", notes: "Profiling legacy CRM export" },
  { id: "hl3", date: "2026-06-22", person: "Sarah Chen", hours: 4, activity: "Project Management", notes: "Sprint planning, stakeholder updates" },
];
