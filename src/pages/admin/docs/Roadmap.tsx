import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Database, 
  Layout, 
  BarChart3, 
  Link2, 
  AlertTriangle,
  Brain,
  Sparkles,
  Rocket,
  FileSearch,
  Mail,
  Shield,
  GitBranch,
  CheckCircle2,
  CircleDashed
} from "lucide-react";

const phases = [
  {
    week: "Week 1-2",
    name: "Foundation",
    icon: Database,
    status: "complete",
    description: "Database schema and core data layer",
    deliverables: [
      "Loans, borrowers, timeline tables",
      "Conditions and milestones tables",
      "Risk scores and SLA configuration",
      "RLS policies for all tables"
    ]
  },
  {
    week: "Week 3-4",
    name: "Core UI",
    icon: Layout,
    status: "complete",
    description: "Loan management interface",
    deliverables: [
      "Loans list page with filters",
      "Loan detail page",
      "Timeline component",
      "Condition tracker component"
    ]
  },
  {
    week: "Week 5",
    name: "Manager Dashboard",
    icon: BarChart3,
    status: "complete",
    description: "Operations visibility layer",
    deliverables: [
      "Pipeline funnel visualization",
      "Risk heatmap",
      "Bottleneck detection panel",
      "Critical metrics cards"
    ]
  },
  {
    week: "Week 6",
    name: "LOS Integration",
    icon: Link2,
    status: "complete",
    description: "LendingPad connection with OAuth, loan/condition sync, and webhook receiver",
    deliverables: [
      "OAuth2 authentication flow",
      "Loan data sync",
      "Conditions sync",
      "Webhook receiver"
    ]
  },
  {
    week: "Week 7",
    name: "Risk Engine",
    icon: AlertTriangle,
    status: "complete",
    description: "AI-powered risk detection",
    deliverables: [
      "Risk calculation algorithm",
      "SLA tracking logic",
      "Lock expiry detection",
      "Risk alert notifications"
    ]
  },
  {
    week: "Week 8",
    name: "AI Agents",
    icon: Brain,
    status: "complete",
    description: "Intelligent automation",
    deliverables: [
      "File Risk Agent",
      "Daily Action Agent",
      "Action Items page",
      "Agent configuration",
      "Loan Coaching, Precheck, Prioritization, Portfolio Summary, Rate Alert, Compliance, Communication Center agents"
    ]
  },
  {
    week: "Week 9",
    name: "Polish & Launch",
    icon: Sparkles,
    status: "complete",
    description: "Quality and refinement",
    deliverables: [
      "Knowledge base structure",
      "Performance optimization",
      "Bug fixes",
      "User acceptance testing"
    ]
  }
];

const phase2Phases = [
  {
    name: "Phase 2A: Document Intelligence",
    timeline: "Week 10-12 (partially complete)",
    icon: FileSearch,
    items: [
      { label: "Dual-provider architecture (Landing AI + Google Document AI)", status: "planned" },
      { label: "Smart document routing by type", status: "planned" },
      { label: "Visual grounding and field extraction", status: "planned" },
      { label: "Fraud detection and math verification", status: "done" },
      { label: "Extraction field mapping to application data", status: "in_progress" }
    ]
  },
  {
    name: "Phase 2B: Email & Communication",
    timeline: "Week 12-15 (partially complete)",
    icon: Mail,
    items: [
      { label: "Email Intelligence Agent (Gmail/Outlook OAuth)", status: "planned" },
      { label: "Auto-task generation from emails", status: "planned" },
      { label: "AI-drafted replies with approval workflow", status: "in_progress" },
      { label: "Loan-to-email auto-matching", status: "planned" },
      { label: "Document generation automation (loan drafts, approval-first)", status: "done" }
    ]
  },
  {
    name: "Phase 2C: Operations Intelligence",
    timeline: "Week 14-16 (partially complete)",
    icon: Shield,
    items: [
      { label: "SLA Guardian with breach detection", status: "done" },
      { label: "Natural language search bar", status: "in_progress" },
      { label: "Document fraud detection", status: "done" },
      { label: "Review queues and escalation alerts", status: "in_progress" }
    ]
  },
  {
    name: "Phase 2D: Memory & Workflow",
    timeline: "Week 17-20 (partially complete)",
    icon: GitBranch,
    items: [
      { label: "Loan memory events tracking", status: "done" },
      { label: "Decision outcome recording", status: "in_progress" },
      { label: "Workflow normalization engine", status: "in_progress" },
      { label: "Compliance checking and deviation tracking", status: "done" }
    ]
  }
];

const futurePhases = [
  {
    name: "Phase 3: Manager Operations Intelligence",
    timeline: "Month 5-6",
    items: [
      "Ops Visibility Dashboard Agent - Unified operational source of truth",
      "Email Action Tracker Agent - Email-to-action correlation",
      "Vendor Orchestration Agent - External dependency tracking",
      "Ops Sandbox Agent - Safe testing with dry-run capabilities",
      "Fair Benchmarking Agent - Normalized performance comparisons",
      "Knowledge Codification Agent - Encode manager judgment into rules",
      "Ops Drag Index Agent - Measure operational inefficiencies"
    ]
  },
  {
    name: "Phase 4: CRM Integration",
    timeline: "Month 6-7",
    items: ["Jungo integration", "BNTouch integration", "Shape integration", "Unified contact sync"]
  },
  {
    name: "Phase 5: Arive & Encompass",
    timeline: "Month 7-8",
    items: ["Arive full integration", "Encompass read-only", "Multi-LOS support", "Fallback file ingestion"]
  },
  {
    name: "Phase 6: Advanced Analytics",
    timeline: "Month 8-9",
    items: ["Predictive close dates", "Processor performance scoring", "Lender relationship insights", "Revenue forecasting"]
  }
];

function RoadmapContent() {
  return (
    <div className="space-y-8">
      {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Development Roadmap</h1>
          <p className="text-muted-foreground mt-2">
            Mortgage Control Tower: 20-Week Implementation Plan (Phase 1 + Phase 2). Phase 1 is complete in the current codebase; Phase 2 has early completed items with remaining work planned.
          </p>
        </div>

        {/* Phase 1: MVP Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Phase 1: MVP (Weeks 1-9)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-8">
                {phases.map((phase, index) => (
                  <div key={index} className="relative pl-20">
                    {/* Timeline node */}
                    <div className={`absolute left-5 w-6 h-6 rounded-full flex items-center justify-center ${
                      phase.status === "complete" ? "bg-primary" : 
                      phase.status === "current" ? "bg-primary animate-pulse" : 
                      phase.status === "in_progress" ? "bg-primary" :
                      "bg-muted border-2 border-border"
                    }`}>
                      <phase.icon className={`h-3 w-3 ${
                        phase.status === "complete" || phase.status === "current" || phase.status === "in_progress"
                          ? "text-primary-foreground" 
                          : "text-muted-foreground"
                      }`} />
                    </div>
                    
                    {/* Content */}
                    <div className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <Badge variant="outline" className="mb-1">{phase.week}</Badge>
                          <h3 className="text-lg font-semibold">{phase.name}</h3>
                        </div>
                        <Badge variant={
                          phase.status === "complete" ? "default" :
                          phase.status === "current" ? "secondary" :
                          phase.status === "in_progress" ? "secondary" :
                          "outline"
                        }>
                          {phase.status === "complete" ? "Complete" :
                           phase.status === "current" ? "In Progress" :
                           phase.status === "in_progress" ? "In Progress" :
                           "Upcoming"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{phase.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {phase.deliverables.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 2: Productivity AI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Phase 2: Productivity AI (Weeks 10-20)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {phase2Phases.map((phase, index) => (
                <div key={index} className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <phase.icon className="h-4 w-4 text-primary" />
                      </div>
                      <h4 className="font-semibold">{phase.name}</h4>
                    </div>
                    <Badge variant="secondary">{phase.timeline}</Badge>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    {phase.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {item.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        ) : (
                          <CircleDashed className="h-4 w-4 text-muted-foreground/80 mt-0.5 shrink-0" />
                        )}
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline">
                      Done: {phase.items.filter((item) => item.status === "done").length}/{phase.items.length}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Future Phases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Post-Phase 2 Roadmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {futurePhases.map((phase, index) => (
                <div key={index} className="p-4 border rounded-lg border-dashed">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{phase.name}</h4>
                    <Badge variant="outline">{phase.timeline}</Badge>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {phase.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dependencies */}
        <Card>
          <CardHeader>
            <CardTitle>Dependencies & Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Critical Dependencies</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5">High</Badge>
                    <span>LendingPad API access and documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5">High</Badge>
                    <span>Landing AI + Google Document AI API keys</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="destructive" className="mt-0.5">High</Badge>
                    <span>Gmail/Outlook OAuth app registration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-0.5">Med</Badge>
                    <span>AI agent prompts require mortgage domain expertise</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Risk Mitigation</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    <span>Start LendingPad API exploration in Week 1</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    <span>Build mock data layer for UI development</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    <span>Engage mortgage SME for knowledge base content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    <span>Use dual-provider fallback for document extraction</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

export default function Roadmap() {
  return <RoadmapContent />;
}