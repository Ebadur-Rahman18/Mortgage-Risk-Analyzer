import { 
  Mail, 
  FileText, 
  Search, 
  ShieldCheck, 
  Clock, 
  MessageSquare, 
  Bell, 
  CheckSquare, 
  MessageCircle, 
  BarChart3,
  Eye,
  MailCheck,
  Network,
  FlaskConical,
  Scale,
  BookOpen,
  Gauge
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const agents = [
  {
    name: "Email Intelligence Agent",
    description: "Reads your inbox, extracts action items, flags urgent issues, and drafts contextual replies",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    name: "Document Reading Agent",
    description: "Dual-AI extraction from paystubs, W-2s, bank statements, and tax returns with 99.5% accuracy",
    icon: FileText,
    color: "text-mortgage-teal",
    bgColor: "bg-mortgage-teal/10",
  },
  {
    name: "Loan Application Analyzer",
    description: "Instantly flags missing information, inconsistencies, and compliance risks in applications",
    icon: Search,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    name: "Risk & Compliance Monitor",
    description: "Tracks regulatory changes, validates applications against current requirements in real-time",
    icon: ShieldCheck,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  {
    name: "SLA Guardian Agent",
    description: "Alerts before deadlines slip, prevents SLA breaches, tracks turnaround times automatically",
    icon: Clock,
    color: "text-mortgage-gold",
    bgColor: "bg-amber-100",
  },
  {
    name: "Communication Center Agent",
    description: "Auto-generates plain-English status updates, condition requests, and closing notifications",
    icon: MessageSquare,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    name: "Lock Expiration Alert Agent",
    description: "Monitors rate locks across your pipeline, alerts before expirations cost you money",
    icon: Bell,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    name: "Condition Tracking Agent",
    description: "Tracks outstanding conditions, follows up automatically, prevents last-minute scrambles",
    icon: CheckSquare,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  {
    name: "Natural Language Query Agent",
    description: "Ask questions in plain English: 'Show me loans closing this week with missing docs'",
    icon: MessageCircle,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
  {
    name: "Portfolio Summary Agent",
    description: "Generates daily/weekly summaries with key metrics, trends, and recommended actions",
    icon: BarChart3,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
  },
];

const upcomingAgents = [
  {
    name: "Ops Visibility Dashboard Agent",
    description: "Unified source of truth with freshness signals - know who's behind, overloaded, or gaming the system",
    icon: Eye,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  {
    name: "Email Action Tracker Agent",
    description: "Tracks whether emails resulted in file updates - closes the loop on communication effectiveness",
    icon: MailCheck,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  {
    name: "Vendor Orchestration Agent",
    description: "Tracks blockers, ownership, and external dependencies - predicts delays before they happen",
    icon: Network,
    color: "text-violet-600",
    bgColor: "bg-violet-100",
  },
  {
    name: "Ops Sandbox Agent",
    description: "Dry-run actions, impact previews, zero-risk testing with manager approvals",
    icon: FlaskConical,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  {
    name: "Fair Benchmarking Agent",
    description: "Normalizes processor performance for loan complexity - identifies true outliers fairly",
    icon: Scale,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
  },
  {
    name: "Knowledge Codification Agent",
    description: "Encodes manager judgment into rules - enables safe delegation and reduces single-person dependency",
    icon: BookOpen,
    color: "text-sky-600",
    bgColor: "bg-sky-100",
  },
  {
    name: "Ops Drag Index Agent",
    description: "Measures delay between status changes, correlates drag to roles/tools/vendors",
    icon: Gauge,
    color: "text-fuchsia-600",
    bgColor: "bg-fuchsia-100",
  },
];

export function AgenticWorkforceList() {
  return (
    <section className="py-20 bg-gradient-to-b from-mortgage-cream/50 to-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-mortgage-navy mb-4">
            Your Agentic Workforce, Ready to Deploy
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            10 specialized AI agents that work behind your firewall, saving your team hours every week. 
            Each agent is trained specifically for mortgage operations.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent, index) => (
            <div 
              key={agent.name}
              className="group bg-white rounded-xl border border-border p-6 hover:shadow-lg hover:border-mortgage-teal/50 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                  agent.bgColor
                )}>
                  <agent.icon className={cn("w-6 h-6", agent.color)} />
                </div>
                <div>
                  <h3 className="font-semibold text-mortgage-navy mb-2 group-hover:text-mortgage-teal transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {agent.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-2">
            All agents work together seamlessly, sharing context and learning from your operations.
          </p>
          <p className="text-sm text-mortgage-teal font-medium">
            Built on a hardened, enterprise-grade backbone
          </p>
        </div>

        {/* Coming Soon: Phase 3 Agents */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Coming in Phase 3</Badge>
            <h3 className="text-2xl md:text-3xl font-bold text-mortgage-navy mb-3">
              Manager Operations Intelligence
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built from real pain points gathered from mortgage bank managers. 
              These agents solve the visibility gaps, bottlenecks, and coordination challenges that keep managers up at night.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingAgents.map((agent) => (
              <div 
                key={agent.name}
                className="group bg-white/60 rounded-xl border border-dashed border-border p-6 opacity-80 hover:opacity-100 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                    agent.bgColor
                  )}>
                    <agent.icon className={cn("w-6 h-6", agent.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-mortgage-navy">
                        {agent.name}
                      </h3>
                      <Badge variant="outline" className="text-xs">Soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
