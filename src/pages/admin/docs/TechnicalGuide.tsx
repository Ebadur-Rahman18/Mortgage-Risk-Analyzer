import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  Link2, 
  Layout,
  Server,
  GitBranch
} from "lucide-react";

function TechnicalGuideContent() {
  return (
    <div className="space-y-8">
      {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Technical Guide</h1>
          <p className="text-muted-foreground mt-2">
            Developer reference for shipped modules, agents, integrations, and edge-function coverage
          </p>
        </div>

        <Tabs defaultValue="architecture" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="edge-functions">Edge Functions</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
          </TabsList>

          {/* Architecture Tab */}
          <TabsContent value="architecture" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" />
                  System Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg font-mono text-sm">
                  <pre>{`┌─────────────────────────────────────────────────────────────┐
│                         MICT Frontend                        │
│  (React + TypeScript + TailwindCSS + shadcn/ui)             │
├─────────────────────────────────────────────────────────────┤
│ Loans │ Pipeline │ Pricing │ Closing │ Portal │ Compliance │ … │
└───────────────────────────────┬─────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Supabase Client     │
                    │   (React Query)       │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                      Supabase Backend                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Database   │ Edge Functions│   Storage    │     Auth      │
│  (Postgres)  │   (Deno)      │   (Files)    │   (JWT)       │
└──────────────┴──────────────┴──────────────┴────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐     ┌────────▼────────┐     ┌───────▼───────┐
│  LendingPad   │     │  OpenAI / AI    │     │  Zoom / Teams │
│ OAuth + sync  │     │  providers      │     │  (optional)   │
│  (stub sync)  │     │                 │     │               │
└───────────────┘     └─────────────────┘     └───────────────┘`}</pre>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Frontend Stack (live)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• React 18 with TypeScript</li>
                      <li>• Vite for build tooling</li>
                      <li>• TailwindCSS + shadcn/ui</li>
                      <li>• React Query for data fetching</li>
                      <li>• React Router for secured + public docs/calculator routes</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Backend Stack (live)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Supabase (Postgres + Auth)</li>
                      <li>• Edge Functions (Deno runtime, manual-first integration stubs)</li>
                      <li>• Row Level Security (RLS)</li>
                      <li>• Realtime subscriptions</li>
                      <li>• Storage for documents</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Core Tables (updated for Phase 1-7)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      name: "loans",
                      description: "Central entity - loan data; LOS sync via external_id and data_source",
                      columns: ["id", "loan_number", "borrower_id", "loan_officer_id", "status", "loan_amount", "lock_date", "lock_expiration_date", "data_source", "external_id"]
                    },
                    {
                      name: "borrowers",
                      description: "Borrower records; manual entry and external sync (external_id, data_source)",
                      columns: ["id", "first_name", "last_name", "email", "phone", "data_source", "external_id"]
                    },
                    {
                      name: "loan_timeline_events",
                      description: "Unified timeline backbone - all actions from all systems",
                      columns: ["id", "loan_id", "event_type", "event_source", "title", "description", "occurred_at"]
                    },
                    {
                      name: "loan_conditions",
                      description: "Underwriting conditions - PTD, PTF, PTC tracking",
                      columns: ["id", "loan_id", "condition_type", "category", "description", "status", "due_date"]
                    },
                    {
                      name: "loan_risk_scores",
                      description: "AI-calculated risk scores for each loan",
                      columns: ["id", "loan_id", "overall_risk_score", "risk_factors", "stall_risk", "lock_expiry_risk"]
                    },
                    {
                      name: "action_items",
                      description: "User tasks and Daily Action Agent output (no separate daily_action_items table)",
                      columns: ["id", "title", "assigned_to_user_id", "loan_id", "status", "priority", "task_type", "source"]
                    },
                    {
                      name: "borrower_communications",
                      description: "Communication Center Agent drafts and approval lifecycle",
                      columns: ["id", "loan_id", "doc_type", "channel", "draft_content", "status", "draft_version"]
                    },
                    {
                      name: "rate_locks | loan_pricing_snapshots | investor_submissions | hedge_snapshots",
                      description: "Phase 4 pricing / lock / investor / hedge workflow tables",
                      columns: ["loan_id", "lock_type", "expires_at", "winner_investor_code", "status", "snapshot_date"]
                    },
                    {
                      name: "loan_settlement_orders | loan_appraisal_orders | loan_ron_sessions | loan_digital_closing | loan_adverse_actions",
                      description: "Phase 5 closing & digital execution (manual-first records + vendor stubs)",
                      columns: ["loan_id", "provider", "status", "order_date", "scheduled_at", "notes"]
                    },
                    {
                      name: "hmda_lar_entries | hmda_report_runs | nmls_licenses",
                      description: "Phase 7 HMDA reporting + licensing tracker",
                      columns: ["loan_id", "year", "action_taken", "run_type", "nmls_id", "expires_on"]
                    },
                    {
                      name: "integration_settings",
                      description: "Per-tenant integration config (e.g. LendingPad OAuth tokens)",
                      columns: ["id", "provider_name", "config", "is_active", "last_validated_at"]
                    }
                  ].map((table, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono">{table.name}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{table.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {table.columns.map((col, i) => (
                          <code key={i} className="text-xs bg-muted px-1 py-0.5 rounded">{col}</code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Edge Functions Tab */}
          <TabsContent value="edge-functions" className="space-y-6">
            <Card className="border-primary/30">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Last synced: Apr 2026</Badge>
                  <Badge variant="secondary">Phase 4: locks, investor, hedge</Badge>
                  <Badge variant="secondary">Phase 5: closing execution</Badge>
                  <Badge variant="secondary">Phase 7: HMDA / licensing support</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  Edge Functions (active + stubs)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      name: "los-sync-lendingpad",
                      description: "LendingPad sync entrypoint (OAuth validated; full loan/condition API sync still expanding)",
                      triggers: ["Manual", "Cron (when configured)"]
                    },
                    {
                      name: "lendingpad-oauth-start | lendingpad-oauth-callback | lendingpad-oauth-disconnect",
                      description: "LendingPad OAuth connect, callback, and disconnect",
                      triggers: ["User action"]
                    },
                    {
                      name: "transition-loan-status",
                      description: "Phase 2 status machine transitions with role-aware guards",
                      triggers: ["Manual", "API"]
                    },
                    {
                      name: "check-eligibility | import-loan-program-guidelines",
                      description: "Eligibility engine and guideline imports for product matrices",
                      triggers: ["Manual", "API"]
                    },
                    {
                      name: "calculate-closing-costs | run-compliance-rules | import-compliance-rules",
                      description: "Phase 3 fee estimate + deterministic compliance execution/import",
                      triggers: ["Manual", "Scheduled"]
                    },
                    {
                      name: "submit-aus-request",
                      description: "AUS submission stub shell (DU/LP vendor connectivity remains optional)",
                      triggers: ["Manual"]
                    },
                    {
                      name: "pricing-datastores | pricing-rate-sheets-upload | pricing-calculate | rate-locks",
                      description: "Pricing datastores, rate sheets, best execution/quote, and lock lifecycle API",
                      triggers: ["Manual", "API"]
                    },
                    {
                      name: "submit-investor-package | compute-hedge-snapshot",
                      description: "Phase 4 investor delivery stub and hedge analytics snapshots",
                      triggers: ["Manual", "Scheduled"]
                    },
                    {
                      name: "validate-api-key",
                      description: "Integration validation surface for data-feed and closing/compliance stubs",
                      triggers: ["Manual"]
                    },
                    {
                      name: "calculate-loan-risk",
                      description: "Risk scores, SLA-style signals, loan_risk_alerts, lock expiry warnings",
                      triggers: ["Scheduled", "On demand"]
                    },
                    {
                      name: "condition-workflow-engine",
                      description: "Conditions workflow orchestration helper for underwriting process",
                      triggers: ["Manual", "Scheduled"]
                    },
                    {
                      name: "file-risk-agent",
                      description: "File Risk Agent — loan file narrative risk analysis",
                      triggers: ["Manual"]
                    },
                    {
                      name: "generate-daily-actions",
                      description: "Daily Action Agent — prioritized action_items from loan context",
                      triggers: ["Scheduled", "Manual"]
                    },
                    {
                      name: "generate-borrower-update",
                      description: "Communication Center Agent: AI drafts loan documents/messages from loan context (approval-first)",
                      triggers: ["Manual"]
                    },
                    {
                      name: "approve-borrower-communication",
                      description: "Lifecycle for document drafts (approve, reject, mark sent)",
                      triggers: ["Manual"]
                    },
                    {
                      name: "generate-pipeline-summary",
                      description: "Portfolio Summary Agent — narrative from manager dashboard metrics",
                      triggers: ["Manual"]
                    },
                    {
                      name: "loan-coaching-agent",
                      description: "Loan Coaching Agent — contextual coaching on a loan",
                      triggers: ["Manual"]
                    },
                    {
                      name: "underwriter-precheck-agent",
                      description: "Underwriter Precheck Agent — hybrid rules + AI scorecard",
                      triggers: ["Manual"]
                    },
                    {
                      name: "pipeline-prioritization-agent",
                      description: "Pipeline Prioritization Agent — urgency-ranked loans",
                      triggers: ["Manual", "Scheduled"]
                    },
                    {
                      name: "rate-alert-intelligence-agent",
                      description: "Rate Alert Intelligence Agent — locks vs market movement",
                      triggers: ["Manual", "Scheduled"]
                    },
                    {
                      name: "compliance-screening-agent",
                      description: "Compliance Screening Agent — TRID / HMDA / fair lending signals",
                      triggers: ["Manual"]
                    },
                    {
                      name: "branch-performance-coach-agent | compute-leaderboard",
                      description: "Performance coaching and leaderboard computation",
                      triggers: ["Manual", "Scheduled"]
                    },
                    {
                      name: "import-loans-csv",
                      description: "Bulk loan import from CSV",
                      triggers: ["Manual"]
                    },
                    {
                      name: "portal-create-invite | portal-redeem-invite | portal-loan-summary | portal-submit-upload | portal-staff-upload-url",
                      description: "Borrower portal invites, redemption, loan summary, uploads",
                      triggers: ["Borrower / staff action"]
                    },
                    {
                      name: "ai-chat-assistant",
                      description: "Framework AI chat with agent routing",
                      triggers: ["Manual"]
                    },
                    {
                      name: "sync-zoom-files | send-notification | admin-cronjobs",
                      description: "Zoom recording sync, notifications, admin cron orchestration",
                      triggers: ["Webhook", "Scheduled", "Manual"]
                    },
                    {
                      name: "auto-draft-milestone-comm | send-borrower-email",
                      description: "Milestone communication drafts and outbound borrower email",
                      triggers: ["Manual", "Scheduled"]
                    }
                  ].map((func, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <code className="font-semibold text-primary">{func.name}</code>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{func.description}</p>
                      <div className="flex gap-2">
                        {func.triggers.map((trigger, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{trigger}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="border-primary/30">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Last synced: Apr 2026</Badge>
                  <Badge variant="secondary">Manual-first stubs enabled</Badge>
                  <Badge variant="secondary">Vendor APIs optional</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Integration Development (manual-first, vendor-ready)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-3">OAuth2 Flow</h4>
                    <div className="font-mono text-sm bg-muted/50 p-3 rounded">
                      <pre>{`1. User clicks "Connect LendingPad"
2. Redirect to LendingPad OAuth URL
3. User authorizes access
4. Callback with auth code
5. Exchange code for access/refresh tokens
6. Store tokens in integration_settings (provider lendingpad)
7. Use tokens for API calls
8. Auto-refresh tokens before expiry`}</pre>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-3">Sync and Delivery Strategy</h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">Read</Badge>
                        <span>Fetch loans, conditions, milestones from LOS every 15 minutes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">Write</Badge>
                        <span>Push notes and status updates back to LOS on user action</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">Timeline</Badge>
                        <span>Create timeline events for all synced changes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">Conflict</Badge>
                        <span>LOS is source of truth - MICT never overwrites LOS data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">Manual-first</Badge>
                        <span>Phase 4/5/7 workflows run without live vendors; integration providers remain optional stubs until enabled</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-3">Current Integration Surfaces</h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• LOS / Core: LendingPad OAuth + sync</li>
                      <li>• eSign: DocuSign send + webhook path</li>
                      <li>• Pricing & market: investor connector (stub), hedge vendor (stub)</li>
                      <li>• Closing execution stubs: appraisal AMC, flood cert, title/settlement, HOI, RON, eClose/eNote, adverse action notice</li>
                      <li>• Data foundation stubs: credit pull, VOE/VOI, AVM, AUS DU/LP</li>
                      <li>• Collaboration: Zoom sync and Teams integration hooks</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Components Tab */}
          <TabsContent value="components" className="space-y-6">
            <Card className="border-primary/30">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Last synced: Apr 2026</Badge>
                  <Badge variant="secondary">Includes Phase 4/5/7 cards</Badge>
                  <Badge variant="secondary">Includes prequal + widget cores</Badge>
                  <Badge variant="secondary">Includes HMDA + NMLS admin pages</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5 text-primary" />
                  Key Components, Pages, and Agent Surfaces
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { name: "LoanTimeline", path: "src/components/loans/LoanTimeline.tsx", description: "Unified timeline view for a single loan" },
                    { name: "ConditionTracker", path: "src/components/loans/ConditionTracker.tsx", description: "Tabbed view of PTD/PTF/PTC conditions" },
                    { name: "MilestoneTracker", path: "src/components/loans/MilestoneTracker.tsx", description: "Loan milestone progress" },
                    { name: "RiskBadge", path: "src/components/loans/RiskBadge.tsx", description: "Color-coded risk indicator" },
                    { name: "SLAStatusCard", path: "src/components/loans/SLAStatusCard.tsx", description: "SLA status for a loan" },
                    { name: "FileRiskAgentPanel", path: "src/components/loans/FileRiskAgentPanel.tsx", description: "File Risk Agent UI" },
                    { name: "LoanCoachingPanel", path: "src/components/loans/LoanCoachingPanel.tsx", description: "Loan Coaching Agent UI" },
                    { name: "UnderwritingScorecard", path: "src/components/loans/UnderwritingScorecard.tsx", description: "Underwriter Precheck Agent scorecard" },
                    { name: "PriorityQueueView", path: "src/components/loans/PriorityQueueView.tsx", description: "Pipeline prioritization queue" },
                    { name: "RateAlertCard", path: "src/components/loans/RateAlertCard.tsx", description: "Rate Alert Intelligence summary" },
                    { name: "ComplianceChecklist", path: "src/components/loans/ComplianceChecklist.tsx", description: "Compliance Screening checklist" },
                    { name: "ManagerDashboard", path: "src/pages/ManagerDashboard.tsx", description: "Pipeline funnel, risk-by-officer heatmap, bottlenecks, exports, AI summary" },
                    { name: "LoansPipelineBoard", path: "src/components/loans/LoansPipelineBoard.tsx", description: "Kanban-style pipeline board for loans" },
                    { name: "LoanRateLockCard", path: "src/components/loans/phase4/LoanRateLockCard.tsx", description: "Rate lock lifecycle actions on loan detail" },
                    { name: "LoanInvestorSubmissionCard", path: "src/components/loans/phase4/LoanInvestorSubmissionCard.tsx", description: "Investor package submission workflow" },
                    { name: "LoanHedgeCard", path: "src/components/loans/phase4/LoanHedgeCard.tsx", description: "Loan-level hedge assumptions and snapshots" },
                    { name: "LoanSettlementOrdersCard", path: "src/components/loans/phase5/LoanSettlementOrdersCard.tsx", description: "Flood/title/HOI settlement order tracking" },
                    { name: "LoanAppraisalCard", path: "src/components/loans/phase5/LoanAppraisalCard.tsx", description: "Appraisal ordering and status tracking" },
                    { name: "LoanRonCard", path: "src/components/loans/phase5/LoanRonCard.tsx", description: "RON scheduling and session tracking" },
                    { name: "LoanDigitalClosingCard", path: "src/components/loans/phase5/LoanDigitalClosingCard.tsx", description: "eClose/eNote manual execution checklist" },
                    { name: "LoanAdverseActionCard", path: "src/components/loans/phase5/LoanAdverseActionCard.tsx", description: "Adverse action draft generation and tracking" },
                    { name: "PrequalCalculatorCore", path: "src/components/mortgage/PrequalCalculatorCore.tsx", description: "Shared internal/public pre-qualification form engine" },
                    { name: "MortgageCalculatorWidgetCore", path: "src/components/mortgage/MortgageCalculatorWidgetCore.tsx", description: "Public mortgage payment widget engine" },
                    { name: "HmdaReporting", path: "src/pages/admin/HmdaReporting.tsx", description: "Admin HMDA reporting, filters, exports, run logs" },
                    { name: "LicensingTracker", path: "src/pages/admin/LicensingTracker.tsx", description: "Admin NMLS licensing tracker and expiry visibility" },
                    { name: "LoanHmdaCard", path: "src/components/loans/phase7/LoanHmdaCard.tsx", description: "Loan-level HMDA LAR capture/edit card" },
                  ].map((component, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <code className="font-semibold text-primary">{component.name}</code>
                      <p className="text-xs text-muted-foreground mt-1">{component.path}</p>
                      <p className="text-sm mt-2">{component.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}

export default function TechnicalGuide() {
  return <TechnicalGuideContent />;
}
