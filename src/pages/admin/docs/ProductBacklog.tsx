import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const sprints = [
  // Phase 1: MVP (Weeks 1-9) — statuses reflect repo as of Apr 2026
  {
    name: "Sprint 1: Foundation",
    week: "Week 1-2",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Create loans table with RLS policies", status: "done", priority: "high" },
      { task: "Create borrowers table (ORL)", status: "done", priority: "high" },
      { task: "Create loan_timeline_events table", status: "done", priority: "high" },
      { task: "Create loan_conditions table", status: "done", priority: "high" },
      { task: "Create loan_milestones table", status: "done", priority: "medium" },
      { task: "Create loan_risk_scores table", status: "done", priority: "medium" },
      { task: "Create sla_configurations table", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 2: Core UI",
    week: "Week 3-4",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Build Loans list page with filters", status: "done", priority: "high" },
      { task: "Build Loan detail page", status: "done", priority: "high" },
      { task: "Build LoanTimeline component", status: "done", priority: "high" },
      { task: "Build ConditionTracker component", status: "done", priority: "high" },
      { task: "Build RiskBadge component", status: "done", priority: "medium" },
      { task: "Update navigation for MCT", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 3: Manager Dashboard",
    week: "Week 5",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Build Manager Dashboard page", status: "done", priority: "high" },
      { task: "Build PipelineFunnel visualization", status: "done", priority: "high" },
      { task: "Build RiskHeatmap component", status: "done", priority: "high" },
      { task: "Build BottleneckPanel component", status: "done", priority: "medium" },
      { task: "Build critical metrics cards", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 4: LendingPad Integration",
    week: "Week 6",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Create los-sync-lendingpad edge function", status: "done", priority: "high" },
      { task: "Implement OAuth2 authentication flow", status: "done", priority: "high" },
      { task: "Build loan data sync logic", status: "done", priority: "high" },
      { task: "Build conditions sync logic", status: "done", priority: "high" },
      { task: "Implement webhook receiver", status: "done", priority: "medium" },
      { task: "Add sync status UI", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 5: Risk Engine",
    week: "Week 7",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Create calculate-loan-risk edge function", status: "done", priority: "high" },
      { task: "Implement SLA tracking logic", status: "done", priority: "high" },
      { task: "Build risk scoring algorithm", status: "done", priority: "high" },
      { task: "Create risk alerts notification system", status: "done", priority: "medium" },
      { task: "Build lock expiry detection", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 6: AI Agents",
    week: "Week 8",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Configure File Risk Agent", status: "done", priority: "high" },
      { task: "Configure Daily Action Agent", status: "done", priority: "high" },
      { task: "Build daily_action_items table", status: "done", priority: "high" },
      { task: "Create generate-daily-actions edge function", status: "done", priority: "medium" },
      { task: "Build Action Items page", status: "done", priority: "medium" },
      { task: "Configure Loan Coaching Agent", status: "done", priority: "high" },
      { task: "Configure Underwriter Precheck Agent", status: "done", priority: "high" },
      { task: "Configure Pipeline Prioritization Agent", status: "done", priority: "high" },
      { task: "Configure Portfolio Summary Agent", status: "done", priority: "medium" },
      { task: "Configure Rate Alert Intelligence Agent", status: "done", priority: "medium" },
      { task: "Configure Compliance Screening Agent", status: "done", priority: "medium" },
      { task: "Configure Communication Center Agent", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 7: Knowledge & Polish",
    week: "Week 9",
    phase: "Phase 1: MVP",
    status: "done",
    progress: 100,
    items: [
      { task: "Create mortgage knowledge categories", status: "done", priority: "medium" },
      { task: "Add initial content templates", status: "done", priority: "medium" },
      { task: "Performance optimization", status: "done", priority: "medium" },
      { task: "Bug fixes and refinements", status: "done", priority: "high" },
      { task: "User acceptance testing", status: "done", priority: "high" },
      { task: "Borrower portal (invites, staff uploads, loan summary)", status: "done", priority: "medium" },
      { task: "Pricing datastores, calculator, and rate lock tracking", status: "done", priority: "medium" },
      { task: "Tasks module (list, detail, permissions)", status: "done", priority: "medium" },
      { task: "Meetings module (CRUD, Zoom sync scaffold)", status: "done", priority: "medium" },
    ]
  },
  // Mortgage module roadmap (docs/MORTGAGE_MODULES_ROADMAP_STATUS.md) — statuses vs PDF roadmap
  {
    name: "Roadmap: Phase 1 — Data foundation",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "done",
    progress: 100,
    items: [
      { task: "Credit pull — integration stub, pull-credit-report, credit_reports + Loan/Borrower UI (partial)", status: "done", priority: "high" },
      { task: "VOE / VOI — verify-employment stub, employment_verifications + UI (partial)", status: "done", priority: "high" },
      { task: "AVM — property-valuation stub, property_valuations + UI (partial)", status: "done", priority: "high" },
    ]
  },
  {
    name: "Roadmap: Phase 2 — Core origination",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "done",
    progress: 100,
    items: [
      { task: "POS / borrower portal (invites, dashboard, messaging, DocuSign disclosures)", status: "done", priority: "high" },
      { task: "LOS — lifecycle, transitions, underwriting queue, 1003 sections (partial vs full LOS)", status: "done", priority: "high" },
      { task: "DMS — taxonomy, loan_documents, checklist, review queue (partial)", status: "done", priority: "high" },
      { task: "Product & eligibility — guidelines JSONB, check-eligibility, admin loan programs (partial)", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Roadmap: Phase 3 — Pricing & compliance",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "in_progress",
    progress: 83,
    items: [
      { task: "Pricing engine — pricing-calculate, LLPAs, best execution, datastores (partial)", status: "done", priority: "high" },
      { task: "Quick pricer — /pricing/quick (partial)", status: "done", priority: "high" },
      { task: "Compliance rules — deterministic runs + LoanDetail card (partial; not certified engine)", status: "done", priority: "high" },
      { task: "Fee sheet / closing costs — calculate-closing-costs + LoanDetail card (illustrative)", status: "done", priority: "medium" },
      { task: "QC / pre-close — loan_qc_results checklist on LoanDetail (partial)", status: "done", priority: "medium" },
      { task: "AUS — submit-aus-request stub + integration cards (no live DU/LP until configured)", status: "in_progress", priority: "high" },
    ]
  },
  {
    name: "Roadmap: Phase 4 — Rate lock & secondary market",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "done",
    progress: 100,
    items: [
      { task: "Rate lock management — rate-locks edge fn, LoanDetail card, lock sync to loan (partial)", status: "done", priority: "high" },
      { task: "Best execution — loan_pricing_snapshots, LoanDetail strip (partial)", status: "done", priority: "high" },
      { task: "Pipeline / manager dashboard — lock expiring drill-down, investor column (partial)", status: "done", priority: "high" },
      { task: "Investor submission — investor_submissions, submit-investor-package stub (partial)", status: "done", priority: "medium" },
      { task: "Hedge analytics — compute-hedge-snapshot, /pricing/hedge (partial)", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Roadmap: Phase 5 — Closing & digital execution",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "done",
    progress: 100,
    items: [
      { task: "eClose / eNote — manual checklist loan_digital_closing; DocuSign disclosures; eclose stub (partial)", status: "done", priority: "high" },
      { task: "RON — manual loan_ron_sessions + ron-provider-stub (partial)", status: "done", priority: "medium" },
      { task: "Flood / title / HOI — manual loan_settlement_orders + vendor stubs (partial)", status: "done", priority: "high" },
      { task: "Appraisal — manual loan_appraisal_orders + AMC stub (partial)", status: "done", priority: "high" },
      { task: "Adverse action — draft letter + loan_adverse_actions (partial; not legal advice)", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Roadmap: Phase 6 — Borrower experience",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "in_progress",
    progress: 45,
    items: [
      { task: "Pre-qual / pre-approval calculator — internal /pricing/prequal + public /prequal-public (partial)", status: "done", priority: "high" },
      { task: "Mortgage calculator widget — public /mortgage-calculator-widget (partial)", status: "done", priority: "high" },
      { task: "Lead / CRM — Clients module (generic CRM vs mortgage lead engine)", status: "in_progress", priority: "medium" },
      { task: "Automated borrower comms — Communication Center, milestone drafts, approvals (partial)", status: "done", priority: "medium" },
      { task: "Co-branded marketing engine", status: "todo", priority: "low" },
    ]
  },
  {
    name: "Roadmap: Phase 7 — Compliance reporting & licensing",
    week: "Mortgage modules",
    phase: "Mortgage: Roadmap modules",
    status: "done",
    progress: 100,
    items: [
      { task: "HMDA — hmda_lar_entries, LoanDetail card, /admin/hmda-reporting export + run logs (partial)", status: "done", priority: "high" },
      { task: "NMLS / licensing — nmls_licenses, /admin/licensing-tracker (partial)", status: "done", priority: "high" },
    ]
  },
  // Phase 2: Productivity AI (Weeks 10-20)
  {
    name: "Sprint 8: Document Intelligence Foundation",
    week: "Week 10-11",
    phase: "Phase 2: Productivity AI",
    status: "todo",
    progress: 0,
    items: [
      { task: "Create document_providers table with RLS", status: "todo", priority: "high" },
      { task: "Create enhanced document_extractions table", status: "todo", priority: "high" },
      { task: "Create extraction_field_mappings table", status: "todo", priority: "high" },
      { task: "Build extract-document-data edge function with dual-provider support", status: "todo", priority: "high" },
      { task: "Implement Landing AI integration (Parse + Extract APIs)", status: "todo", priority: "high" },
      { task: "Implement Google Document AI integration (Bank Statement, W2, 1040 parsers)", status: "todo", priority: "high" },
      { task: "Build DocumentExtractionCard component", status: "todo", priority: "medium" },
    ]
  },
  {
    name: "Sprint 9: Email Intelligence Agent",
    week: "Week 12-13",
    phase: "Phase 2: Productivity AI",
    status: "todo",
    progress: 0,
    items: [
      { task: "Create email_connections table", status: "todo", priority: "high" },
      { task: "Create parsed_emails table", status: "todo", priority: "high" },
      { task: "Create email_generated_tasks table", status: "todo", priority: "high" },
      { task: "Create email_draft_replies table", status: "todo", priority: "high" },
      { task: "Build connect-email-provider edge function (Gmail/Outlook OAuth)", status: "todo", priority: "high" },
      { task: "Build sync-emails edge function", status: "todo", priority: "high" },
      { task: "Build analyze-email-intent edge function", status: "todo", priority: "high" },
      { task: "Build EmailInbox page", status: "todo", priority: "medium" },
      { task: "Build EmailConnectionCard component", status: "todo", priority: "medium" },
      { task: "Build DraftReplyModal component", status: "todo", priority: "medium" },
    ]
  },
  {
    name: "Sprint 10: SLA Guardian & Natural Language Search",
    week: "Week 14",
    phase: "Phase 2: Productivity AI",
    status: "in_progress",
    progress: 29,
    items: [
      { task: "Create sla_definitions table", status: "todo", priority: "high" },
      { task: "Create sla_breaches table", status: "todo", priority: "high" },
      { task: "Build check-sla-status edge function", status: "todo", priority: "high" },
      { task: "Build natural-language-query edge function", status: "todo", priority: "high" },
      { task: "Build NaturalLanguageSearchBar component", status: "todo", priority: "medium" },
      { task: "Build SLADashboard page (/admin/sla via SLAManagement)", status: "done", priority: "medium" },
      { task: "Build SLAStatusBadge component (shipped as SLAStatusCard)", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 11: Communication Center Agent",
    week: "Week 15",
    phase: "Phase 2: Productivity AI",
    status: "done",
    progress: 100,
    items: [
      { task: "Create borrower_communications table", status: "done", priority: "high" },
      { task: "Build generate-borrower-update edge function", status: "done", priority: "high" },
      { task: "Build BorrowerUpdateDraft component", status: "done", priority: "medium" },
      { task: "Build CommunicationCenter page", status: "done", priority: "medium" },
      { task: "Integrate with email sending system", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 12: Document Fraud Detection",
    week: "Week 16",
    phase: "Phase 2: Productivity AI",
    status: "in_progress",
    progress: 20,
    items: [
      { task: "Build detect-document-fraud edge function", status: "todo", priority: "high" },
      { task: "Implement bank statement math verification", status: "todo", priority: "high" },
      { task: "Implement income cross-reference logic", status: "todo", priority: "high" },
      { task: "Build FraudAlertCard component", status: "todo", priority: "medium" },
      { task: "Build DocumentReviewQueue page", status: "done", priority: "medium" },
    ]
  },
  {
    name: "Sprint 13: Memory Layer Foundation",
    week: "Week 17",
    phase: "Phase 2: Productivity AI",
    status: "todo",
    progress: 0,
    items: [
      { task: "Create loan_memory_events table", status: "todo", priority: "high" },
      { task: "Create decision_outcomes table", status: "todo", priority: "high" },
      { task: "Create agent_performance_memory table", status: "todo", priority: "high" },
      { task: "Build calculate-loan-memory edge function", status: "todo", priority: "high" },
      { task: "Build record-decision-outcome edge function", status: "todo", priority: "medium" },
    ]
  },
  {
    name: "Sprint 14: Workflow Normalization Engine",
    week: "Week 18",
    phase: "Phase 2: Productivity AI",
    status: "todo",
    progress: 0,
    items: [
      { task: "Create workflow_stages table", status: "todo", priority: "high" },
      { task: "Create workflow_stage_rules table", status: "todo", priority: "high" },
      { task: "Create loan_workflow_progress table", status: "todo", priority: "high" },
      { task: "Create workflow_deviations table", status: "todo", priority: "medium" },
      { task: "Build check-workflow-compliance edge function", status: "todo", priority: "high" },
      { task: "Build WorkflowProgressTracker component", status: "todo", priority: "medium" },
    ]
  },
  {
    name: "Sprint 15: Integration & Polish",
    week: "Week 19-20",
    phase: "Phase 2: Productivity AI",
    status: "todo",
    progress: 0,
    items: [
      { task: "Connect Phase 2 tables to MVP loan data", status: "todo", priority: "high" },
      { task: "Build DocumentProcessingSettings admin page", status: "todo", priority: "medium" },
      { task: "Build ProviderComparisonView component", status: "todo", priority: "medium" },
      { task: "Performance optimization for document processing", status: "todo", priority: "high" },
      { task: "End-to-end testing for Phase 2 features", status: "todo", priority: "high" },
    ]
  },
  // Phase 3: Manager Operations Intelligence (Backlog)
  {
    name: "Sprint 16: Manager Operations Agents",
    week: "Week 21-24",
    phase: "Phase 3: Manager Intelligence",
    status: "backlog",
    progress: 0,
    items: [
      { task: "Create ops_visibility_snapshots table", status: "backlog", priority: "high" },
      { task: "Build Ops Visibility Dashboard Agent", status: "backlog", priority: "high" },
      { task: "Create email_action_correlations table", status: "backlog", priority: "high" },
      { task: "Build Email Action Tracker Agent", status: "backlog", priority: "high" },
      { task: "Create vendor_dependencies table", status: "backlog", priority: "medium" },
      { task: "Build Vendor Orchestration Agent", status: "backlog", priority: "medium" },
      { task: "Build Ops Sandbox with dry-run mode", status: "backlog", priority: "medium" },
      { task: "Create processor_benchmarks table", status: "backlog", priority: "medium" },
      { task: "Build Fair Benchmarking Agent", status: "backlog", priority: "medium" },
      { task: "Create decision_rules table", status: "backlog", priority: "medium" },
      { task: "Build Knowledge Codification Agent", status: "backlog", priority: "medium" },
      { task: "Create ops_drag_metrics table", status: "backlog", priority: "low" },
      { task: "Build Ops Drag Index Agent", status: "backlog", priority: "low" },
    ]
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-primary" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "blocked":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "backlog":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return <Badge variant="secondary">Medium</Badge>;
    default:
      return <Badge variant="outline">Low</Badge>;
  }
};

function ProductBacklogContent() {
  const totalItems = sprints.reduce((acc, sprint) => acc + sprint.items.length, 0);
  const completedItems = sprints.reduce((acc, sprint) => 
    acc + sprint.items.filter(item => item.status === "done").length, 0
  );
  const overallProgress = Math.round((completedItems / totalItems) * 100);

  const phase1Sprints = sprints.filter(s => s.phase === "Phase 1: MVP");
  const mortgageRoadmapSprints = sprints.filter(s => s.phase === "Mortgage: Roadmap modules");
  const phase2Sprints = sprints.filter(s => s.phase === "Phase 2: Productivity AI");
  const phase3Sprints = sprints.filter(s => s.phase === "Phase 3: Manager Intelligence");

  const sprintStatusBadge = (status: string) => {
    if (status === "done") return { label: "Complete", variant: "default" as const };
    if (status === "in_progress") return { label: "In Progress", variant: "secondary" as const };
    if (status === "backlog") return { label: "Backlog", variant: "outline" as const };
    return { label: "Upcoming", variant: "outline" as const };
  };

  return (
    <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Product Backlog</h1>
          <p className="text-muted-foreground mt-2">
            Internal sprint plan (Phases 1–3) plus mortgage module delivery tracked against{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">docs/MORTGAGE_MODULES_ROADMAP_STATUS.md</code>.
            Task checkmarks mean shipped in-repo; roadmap wording still marks many items as partial versus the PDF spec.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Quick links:{" "}
            <Link to="/prequal-public" className="text-primary underline-offset-4 hover:underline">Public pre-qual</Link>
            {" · "}
            <Link to="/mortgage-calculator-widget" className="text-primary underline-offset-4 hover:underline">Calculator widget</Link>
            {" · "}
            <Link to="/admin/hmda-reporting" className="text-primary underline-offset-4 hover:underline">HMDA</Link>
            {" · "}
            <Link to="/admin/licensing-tracker" className="text-primary underline-offset-4 hover:underline">NMLS</Link>
            {" · "}
            <Link to="/docs/vision" className="text-primary underline-offset-4 hover:underline">Vision</Link>
          </p>
        </div>

        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={overallProgress} className="flex-1" />
              <span className="text-2xl font-bold">{overallProgress}%</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{totalItems}</div>
                <div className="text-sm text-muted-foreground">Total Tasks</div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary">{completedItems}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {sprints.reduce((acc, sprint) => 
                    acc + sprint.items.filter(item => item.status === "in_progress").length, 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">
                  {sprints.reduce((acc, sprint) => 
                    acc + sprint.items.filter(item => item.status === "todo").length, 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Todo</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 1: MVP */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-base px-4 py-1">Phase 1: MVP</Badge>
            <span className="text-muted-foreground">Weeks 1-9 • Core Platform</span>
          </div>
          
          {phase1Sprints.map((sprint, sprintIndex) => {
            const sprintCompleted = sprint.items.filter(item => item.status === "done").length;
            const sprintProgress = Math.round((sprintCompleted / sprint.items.length) * 100);
            
            return (
              <Card key={sprintIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{sprint.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{sprint.week}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{sprintCompleted}/{sprint.items.length} tasks</div>
                        <Progress value={sprintProgress} className="w-24 h-2" />
                      </div>
                      <Badge variant={sprintStatusBadge(sprint.status).variant}>
                        {sprintStatusBadge(sprint.status).label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sprint.items.map((item, itemIndex) => (
                      <div 
                        key={itemIndex}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <span className={item.status === "done" ? "line-through text-muted-foreground" : ""}>
                            {item.task}
                          </span>
                        </div>
                        {getPriorityBadge(item.priority)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Mortgage module roadmap (PDF matrix ↔ repo) */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge className="text-base px-4 py-1 bg-primary/15 text-primary border border-primary/30">
              Mortgage: Roadmap modules
            </Badge>
            <span className="text-muted-foreground">Phases 1–7 — aligned with implementation status doc & current code</span>
          </div>

          {mortgageRoadmapSprints.map((sprint, sprintIndex) => {
            const sprintCompleted = sprint.items.filter(item => item.status === "done").length;
            const sprintProgress = Math.round((sprintCompleted / sprint.items.length) * 100);
            const sb = sprintStatusBadge(sprint.status);

            return (
              <Card key={`mortgage-${sprintIndex}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{sprint.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{sprint.week}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{sprintCompleted}/{sprint.items.length} tasks</div>
                        <Progress value={sprintProgress} className="w-24 h-2" />
                      </div>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sprint.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <span className={item.status === "done" ? "line-through text-muted-foreground" : ""}>
                            {item.task}
                          </span>
                        </div>
                        {getPriorityBadge(item.priority)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Phase 2: Productivity AI */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-base px-4 py-1">Phase 2: Productivity AI</Badge>
            <span className="text-muted-foreground">Weeks 10-20 • Document Intelligence, Email Agent, SLA Guardian</span>
          </div>
          
          {phase2Sprints.map((sprint, sprintIndex) => {
            const sprintCompleted = sprint.items.filter(item => item.status === "done").length;
            const sprintProgress = Math.round((sprintCompleted / sprint.items.length) * 100);
            
            return (
              <Card key={sprintIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{sprint.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{sprint.week}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{sprintCompleted}/{sprint.items.length} tasks</div>
                        <Progress value={sprintProgress} className="w-24 h-2" />
                      </div>
                      <Badge variant={sprintStatusBadge(sprint.status).variant}>
                        {sprintStatusBadge(sprint.status).label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sprint.items.map((item, itemIndex) => (
                      <div 
                        key={itemIndex}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <span className={item.status === "done" ? "line-through text-muted-foreground" : ""}>
                            {item.task}
                          </span>
                        </div>
                        {getPriorityBadge(item.priority)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Phase 3: Manager Intelligence (Backlog) */}
        {phase3Sprints.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-base px-4 py-1 border-dashed">Phase 3: Manager Intelligence</Badge>
              <span className="text-muted-foreground">Weeks 21-24 • Backlog - Built from Mortgage Bank Manager Pain Points</span>
            </div>
            
            {phase3Sprints.map((sprint, sprintIndex) => {
              const sprintCompleted = sprint.items.filter(item => item.status === "done").length;
              const sprintProgress = Math.round((sprintCompleted / sprint.items.length) * 100);
              
              return (
                <Card key={sprintIndex} className="border-dashed opacity-80">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{sprint.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{sprint.week}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium">{sprintCompleted}/{sprint.items.length} tasks</div>
                          <Progress value={sprintProgress} className="w-24 h-2" />
                        </div>
                        <Badge variant="outline" className="border-dashed">Backlog</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sprint.items.map((item, itemIndex) => (
                        <div 
                          key={itemIndex}
                          className="flex items-center justify-between p-3 border border-dashed rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(item.status)}
                            <span className="text-muted-foreground">
                              {item.task}
                            </span>
                          </div>
                          {getPriorityBadge(item.priority)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

export default function ProductBacklog() {
  return <ProductBacklogContent />;
}