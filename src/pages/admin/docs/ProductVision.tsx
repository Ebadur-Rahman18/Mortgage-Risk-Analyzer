import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  Target, 
  Users, 
  Compass, 
  Brain, 
  Link2, 
  BookOpen,
  TrendingUp,
  Building2,
  UserCheck,
  Clock
} from "lucide-react";

const designPrinciples = [
  { title: "Manager-first visibility", description: "Dashboards designed for operations leaders, not individual contributors" },
  { title: "Timeline as backbone", description: "Every action from every system captured in one unified timeline per loan" },
  { title: "AI suggests, humans approve", description: "No autonomous actions - AI provides recommendations, users make decisions" },
  { title: "Read-heavy integrations first", description: "Start with data ingestion, add write-back capabilities progressively" },
  { title: "Calm, operational UX", description: "No AI theatrics - serious, trustworthy interface for professionals" },
];

const coreModules = [
  { name: "Manager operations dashboard", description: "Cross-branch visibility into pipeline, untouched-loan aging, bottlenecks, and risk trends", href: "/pipeline" },
  { name: "Inactivity reminder orchestration", description: "Manager-triggered reminders/escalations for loans untouched for 7+ and 21+ days", href: "/pipeline" },
  { name: "Action ownership workflow", description: "Action items and notifications route follow-ups from managers to branch officers and loan officers", href: "/action-items" },
  { name: "Borrower communication workflow", description: "AI-assisted borrower updates with explicit human approval gates", href: "/communication-center" },
  { name: "Compliance & reporting baseline", description: "Deterministic compliance rules plus HMDA/NMLS tracking for operational oversight", href: "/admin/compliance-rules" },
];

const aiAgents = [
  { name: "Manager Insight Agent", purpose: "Answer natural language questions about stale loans, workload, and ownership gaps", value: "Shipped — manager dashboard" },
  { name: "Daily Action Agent", purpose: "Generate prioritized daily actions from pipeline risk and timeline context", value: "Shipped — Action Items" },
  { name: "Pipeline Prioritization Agent", purpose: "Urgency-rank loans for managerial focus and officer follow-up", value: "Shipped — loans / manager views" },
];

const additionalPlatformAgents = [
  { name: "File Risk Agent", purpose: "Detect early operational risk from timeline/conditions/lock behavior", value: "Shipped — loan detail / AI agents" },
  { name: "Portfolio Summary Agent", purpose: "Produce narrative briefing from manager dashboard metrics", value: "Shipped — manager dashboard" },
  { name: "Communication Center Agent", purpose: "Draft borrower communications with human approval", value: "Shipped — Communication Center" },
  { name: "Loan Coaching Agent", purpose: "Real-time coaching context on a loan file", value: "Shipped — loan detail" },
  { name: "Underwriter Precheck Agent", purpose: "Hybrid rules plus AI underwriting scorecard", value: "Shipped — loan detail" },
  { name: "Rate Alert Intelligence Agent", purpose: "Monitor lock movement and surface rate-risk narratives", value: "Shipped — manager and loan views" },
  { name: "Compliance Screening Agent", purpose: "TRID, HMDA, fair lending style checks", value: "Shipped — loan detail" },
];

const liveFrameworkModules = [
  { name: "Tasks", description: "Task list, detail, permissions, and feature flags", href: "/tasks" },
  { name: "Meetings", description: "Full CRUD, status lifecycle, and Zoom sync scaffolding", href: "/meetings" },
  { name: "Knowledge base", description: "Shared and personal libraries, uploads, semantic search hooks", href: "/knowledge" },
  { name: "Borrower portal", description: "Invites, redemption, loan summary, messaging, and document uploads", href: "/portal" },
  { name: "Pricing & rate locks", description: "Datastores, calculator, quick pricer, lock tracking, investor submissions, and hedge analytics (currently disabled)", href: "" },
  { name: "Closing execution", description: "Manual-first eClose checklist, RON sessions, settlement orders, appraisal tracking, adverse action draft support", href: "/loans" },
  { name: "Borrower experience calculators", description: "Internal pre-qual tool (currently disabled) and public pre-qual/widget pages for borrower estimates", href: "/prequal-public" },
  { name: "Compliance reporting & licensing", description: "HMDA LAR loan capture, admin HMDA export/logs, and NMLS licensing tracker with expiration visibility", href: "/admin/hmda-reporting" },
  { name: "Admin operations", description: "Integrations, modules, SLA, compliance rules, cron jobs, AI usage analytics, and Teams integrations", href: "/admin" },
];

function ProductVisionContent() {
  return (
    <div className="space-y-8">
      {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Product Vision</h1>
          <p className="text-muted-foreground mt-2">
            Mortgage Intelligence Control Tower (MICT) - live implementation view
          </p>
        </div>

        {/* Executive Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-lg font-medium text-center">
                "Fewer surprises. Fewer fire drills. More control."
              </p>
            </div>
            <p className="text-muted-foreground">
              Mortgage Intelligence Control Tower is a <strong>manager-first operational intelligence layer</strong> for 
              mortgage lenders and brokers. It does not replace LOS or CRM systems — it <strong>orchestrates them</strong>.
            </p>
            <p className="text-muted-foreground">
              The product gives teams visibility, predictability, and early risk detection across the mortgage lifecycle.
              The current build includes implemented modules from data foundation through pricing, closing execution, and
              a manual-first compliance reporting baseline.
            </p>
          </CardContent>
        </Card>

        {/* Target Market */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Primary Buyer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Badge variant="secondary">Head of Operations</Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="secondary">Branch Manager</Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="secondary">COO at mid-size lenders</Badge>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Primary Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Badge variant="outline">Loan Officers</Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline">Processors</Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline">Team Leads</Badge>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Ideal Company Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Ideal Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">20-100</div>
                <div className="text-sm text-muted-foreground">Agents</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <div className="text-lg font-medium">Existing LOS</div>
                <div className="text-sm text-muted-foreground">They cannot replace</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <div className="text-lg font-medium">Residential/Commercial</div>
                <div className="text-sm text-muted-foreground">Mortgage pipelines</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <div className="text-lg font-medium">Busy but Blind</div>
                <div className="text-sm text-muted-foreground">Lacks visibility</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Design Principles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Design Principles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {designPrinciples.map((principle, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="font-medium mb-1">{principle.title}</div>
                  <div className="text-sm text-muted-foreground">{principle.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Core Modules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Core platform modules (current state)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {coreModules.map((module, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    {module.href ? (
                      <Link to={module.href} className="font-medium text-primary underline">
                        {module.name}
                      </Link>
                    ) : (
                      <div className="font-medium">{module.name}</div>
                    )}
                    <div className="text-sm text-muted-foreground">{module.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Managerial control tower agents (primary focus)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {aiAgents.map((agent, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <Badge className="mb-2">Agent {index + 1}</Badge>
                  <div className="font-semibold text-lg mb-2">{agent.name}</div>
                  <div className="text-sm text-muted-foreground mb-3">{agent.purpose}</div>
                  <div className="text-xs text-primary font-medium">{agent.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional agents live in codebase */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Additional implemented agents in this codebase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These agents are seeded/toggled in Admin and wired across loan detail, pipeline, and Communication Center workflows.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {additionalPlatformAgents.map((agent, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="font-semibold text-lg mb-2">{agent.name}</div>
                  <div className="text-sm text-muted-foreground mb-3">{agent.purpose}</div>
                  <div className="text-xs text-primary font-medium">{agent.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Framework modules present today */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Framework modules live in this codebase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {liveFrameworkModules.map((mod, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  {mod.href ? (
                    <Link to={mod.href} className="font-medium mb-1 text-primary underline inline-block">
                      {mod.name}
                    </Link>
                  ) : (
                    <div className="font-medium mb-1">{mod.name}</div>
                  )}
                  <div className="text-sm text-muted-foreground">{mod.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integration Strategy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Integration strategy (implemented now)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">LOS and core system integrations</h4>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Link to="/admin/integrations" className="font-medium text-primary underline">1. LendingPad</Link>
                      <Badge>Implemented</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">OAuth + loan sync + webhook handling are implemented and configurable in Admin Integrations.</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Link to="/admin/integrations" className="font-medium text-primary underline">2. DocuSign</Link>
                      <Badge variant="secondary">Implemented</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Disclosure send + webhook callbacks are implemented; full eClose/eNote remains phased.</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Link to="/admin/integrations" className="font-medium text-primary underline">3. Data feed providers</Link>
                      <Badge variant="outline">Stub-enabled</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Freddie/Fannie/Credit/VOE/AVM/AUS plus Phase 4/5 stubs with integration settings and key validation.</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Operational integration posture</h4>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <Link to="/loans" className="font-medium text-primary underline">Manual-first workflows in critical modules</Link>
                    <p className="text-sm text-muted-foreground mt-1">Closing, investor delivery, HMDA, and licensing workflows work without external vendors by design.</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <Link to="/admin/roles" className="font-medium text-primary underline">Role- and branch-scoped data access</Link>
                    <p className="text-sm text-muted-foreground mt-1">RLS policies enforce LO/UW/admin/branch-manager visibility and mutate scopes on loan-linked tables.</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <Link to="/prequal-public" className="font-medium text-primary underline">Borrower estimate experiences</Link>
                    <p className="text-sm text-muted-foreground mt-1">Public pre-qual and mortgage widget pages remain available; internal pricing pre-qual is currently disabled.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              MVP Success Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-sm text-muted-foreground mb-1">Primary KPI</div>
                <div className="text-2xl font-bold text-primary">30% Reduction</div>
                <div className="text-sm text-muted-foreground mt-1">in loans entering third underwriting cycle</div>
              </div>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Secondary Indicators</div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Daily manager logins
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Reduced silence gaps
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Faster issue detection
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Base Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Knowledge Base Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              {[
                { name: "Underwriting Intelligence", items: ["Investor rules", "Common conditions", "Past approvals"] },
                { name: "Communication Playbooks", items: ["Borrower explanations", "Realtor updates", "Delay scripts"] },
                { name: "Compliance", items: ["TRID", "RESPA", "State rules"] },
                { name: "Role SOPs", items: ["Loan Officer", "Processor", "Manager"] },
                { name: "System Behavior", items: ["LOS quirks", "CRM sync issues", "Failure patterns"] },
              ].map((category, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">{category.name}</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {category.items.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

export default function ProductVision() {
  return <ProductVisionContent />;
}
