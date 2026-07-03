export interface AgentTeamAgent {
  name: string;
  slug: string;
  description: string;
  icon: string;
  capabilities?: string[];
  howToUse?: string[];
  whereToFind?: {
    label: string;
    path: string;
  };
}

export interface AgentTeamDef {
  id: string;
  name: string;
  tagline: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  agents: AgentTeamAgent[];
}

export const agentTeams: Record<string, AgentTeamDef> = {
  sales: {
    id: "sales",
    name: "Sales Intelligence Team",
    tagline: "AI agents that help close more deals",
    accentColor: "border-b-red-500",
    gradientFrom: "280 70% 50%",
    gradientTo: "330 80% 55%",
    agents: [
      {
        name: "Deal Coach",
        slug: "deal-coach",
        description: "Real-time coaching and insights to help you win more deals",
        icon: "Trophy",
        capabilities: [
          "Analyzes deal health and identifies risks",
          "Provides tailored next-step recommendations",
          "Surfaces competitive intelligence from your knowledge base",
          "Tracks deal velocity and flags stalled opportunities",
        ],
        howToUse: [
          "Navigate to the Deals Pipeline",
          "Open any deal and click the Deal Coach icon",
          "Ask for a deal assessment or next-step suggestions",
          "Review the coaching tips and take action",
        ],
        whereToFind: { label: "Deals Pipeline", path: "/deals" },
      },
      {
        name: "Daily Briefing",
        slug: "deal-daily-briefing",
        description: "Your morning summary of deals, priorities, and actions for the day",
        icon: "Newspaper",
        capabilities: [
          "Summarizes your top deals and their current status",
          "Highlights deals requiring immediate attention",
          "Provides a prioritized action list for the day",
          "Surfaces recent activity across your pipeline",
        ],
        howToUse: [
          "Visit the AI Hub each morning",
          "The briefing is automatically generated for your pipeline",
          "Review your priorities and action items",
          "Click any deal to navigate directly to it",
        ],
        whereToFind: { label: "AI Hub", path: "/ai" },
      },
      {
        name: "Quick Deal Email",
        slug: "quick-deal-email",
        description: "Generate personalized follow-up emails for any deal in seconds",
        icon: "Mail",
        capabilities: [
          "Drafts context-aware follow-up emails",
          "Personalizes content based on deal stage and history",
          "Suggests subject lines optimized for open rates",
          "Adapts tone to match previous communication style",
        ],
        howToUse: [
          "Open a deal or contact record",
          "Click 'Quick Email' to launch the agent",
          "Select the email type and any custom notes",
          "Review, edit, and send the generated draft",
        ],
        whereToFind: { label: "Deals & Contacts", path: "/clients" },
      },
      {
        name: "Deal AI Chat",
        slug: "deal-ai-chat",
        description: "Chat directly with your deal data — ask anything about your pipeline",
        icon: "MessageSquare",
        capabilities: [
          "Answers natural language questions about your pipeline",
          "Compares deals, stages, and team performance",
          "Identifies patterns and trends across opportunities",
          "Generates reports and summaries on demand",
        ],
        howToUse: [
          "Go to the AI Hub",
          "Start a conversation with the Deal AI Chat agent",
          "Ask questions like 'Show me stalled deals this quarter'",
          "Explore insights and drill into specifics",
        ],
        whereToFind: { label: "AI Hub", path: "/ai" },
      },
    ],
  },
  meetings: {
    id: "meetings",
    name: "Meeting AI Team",
    tagline: "Turn every meeting into structured, actionable outcomes",
    accentColor: "border-b-blue-500",
    gradientFrom: "190 80% 45%",
    gradientTo: "210 85% 55%",
    agents: [
      {
        name: "Meeting Summarizer",
        slug: "meeting-summarizer",
        description: "Automatically generates concise summaries of your meeting transcripts",
        icon: "FileText",
        capabilities: [
          "Produces structured summaries with key discussion points",
          "Identifies decisions made during the meeting",
          "Highlights risks and open questions",
          "Formats output for easy sharing with stakeholders",
        ],
        howToUse: [
          "Navigate to Meeting Transcripts",
          "Select a transcript and open the Summarizer",
          "Click 'Generate Summary'",
          "Review and share the structured summary",
        ],
        whereToFind: { label: "Meeting Transcripts", path: "/meetings" },
      },
      {
        name: "Action Extractor",
        slug: "action-item-extractor",
        description: "Extracts and assigns action items directly from your meeting transcripts",
        icon: "ListChecks",
        capabilities: [
          "Identifies all commitments and follow-ups from conversations",
          "Assigns owners based on who agreed to each task",
          "Sets suggested due dates based on context",
          "Integrates extracted items into your task board",
        ],
        howToUse: [
          "Open a meeting detail page",
          "Navigate to the Takeaways tab",
          "Click 'Extract Action Items'",
          "Review assignments and confirm or adjust",
        ],
        whereToFind: { label: "Meeting Detail → Takeaways", path: "/meetings" },
      },
      {
        name: "Efficiency Analyzer",
        slug: "meeting-efficiency-analyzer",
        description: "Scores your meetings on effectiveness and suggests improvements",
        icon: "Gauge",
        capabilities: [
          "Rates meetings on clarity, engagement, and outcomes",
          "Identifies talking time imbalances",
          "Flags meetings without clear action items",
          "Tracks efficiency trends over time",
        ],
        howToUse: [
          "Go to the AI Hub",
          "Select the Efficiency Analyzer agent",
          "Choose a meeting or date range to analyze",
          "Review the efficiency report and recommendations",
        ],
        whereToFind: { label: "AI Hub", path: "/ai" },
      },
      {
        name: "Client Call Analyzer",
        slug: "client-call-analyzer",
        description: "Deep analysis of client calls to surface sentiment, risks, and opportunities",
        icon: "PhoneCall",
        capabilities: [
          "Detects client sentiment and emotional tone",
          "Identifies objections and buying signals",
          "Surfaces relationship risks before they escalate",
          "Recommends follow-up strategies based on call content",
        ],
        howToUse: [
          "Open a meeting transcript from a client call",
          "Click 'Analyze Call' in the transcript view",
          "Review the sentiment and risk report",
          "Use the recommended follow-up actions",
        ],
        whereToFind: { label: "Meeting Transcripts", path: "/meetings" },
      },
    ],
  },
  eos: {
    id: "eos",
    name: "Strategy AI Team",
    tagline: "Align your team around goals and strategic priorities",
    accentColor: "border-b-amber-500",
    gradientFrom: "30 90% 50%",
    gradientTo: "45 95% 55%",
    agents: [
      {
        name: "EOS Coach",
        slug: "eos-coach",
        description: "Guides your team through EOS principles, rocks, and quarterly planning",
        icon: "GraduationCap",
        capabilities: [
          "Coaches on EOS methodology and best practices",
          "Reviews rocks for clarity, measurability, and achievability",
          "Facilitates L10 meeting preparation",
          "Helps define and refine your Vision/Traction Organizer",
        ],
        howToUse: [
          "Navigate to the Strategy section",
          "Open the EOS Coach agent",
          "Ask for help with any EOS concept or tool",
          "Follow the guided coaching conversation",
        ],
        whereToFind: { label: "Strategy Section", path: "/dashboard" },
      },
      {
        name: "Pattern Detective",
        slug: "eos-pattern-detective",
        description: "Uncovers recurring issues and root causes hiding in your team data",
        icon: "Search",
        capabilities: [
          "Identifies patterns in issues list over time",
          "Connects recurring problems to root causes",
          "Surfaces organizational health risks",
          "Recommends systemic fixes over one-time patches",
        ],
        howToUse: [
          "Ensure your issues and meeting notes are logged",
          "Launch Pattern Detective from the Strategy section",
          "Select the time range to analyze",
          "Review the pattern report and prioritize fixes",
        ],
        whereToFind: { label: "Strategy Section", path: "/dashboard" },
      },
      {
        name: "Pod Health",
        slug: "eos-pod-health",
        description: "Monitors team pod health scores and surfaces burnout risks early",
        icon: "HeartPulse",
        capabilities: [
          "Tracks individual and team health signals",
          "Detects early burnout and disengagement indicators",
          "Benchmarks pod health against targets",
          "Recommends interventions before issues escalate",
        ],
        howToUse: [
          "Open the Pod Health agent from the Strategy section",
          "Select your pod or team to review",
          "Review the health dashboard and risk indicators",
          "Take suggested actions to improve team wellbeing",
        ],
        whereToFind: { label: "Strategy Section", path: "/dashboard" },
      },
      {
        name: "Quarterly Digest",
        slug: "eos-quarterly-digest",
        description: "Automatically compiles a comprehensive quarterly performance digest",
        icon: "CalendarRange",
        capabilities: [
          "Aggregates rock completion rates and outcomes",
          "Summarizes key wins, losses, and learnings",
          "Benchmarks Q performance against prior quarters",
          "Prepares executive-ready quarterly report drafts",
        ],
        howToUse: [
          "Navigate to the Strategy section at quarter end",
          "Launch the Quarterly Digest agent",
          "Select the quarter to summarize",
          "Review, edit, and distribute the generated digest",
        ],
        whereToFind: { label: "Strategy Section", path: "/dashboard" },
      },
    ],
  },
  projects: {
    id: "projects",
    name: "Project AI Team",
    tagline: "Accelerate delivery with AI-powered project intelligence",
    accentColor: "border-b-emerald-500",
    gradientFrom: "150 70% 40%",
    gradientTo: "170 75% 50%",
    agents: [
      {
        name: "Project Analyst",
        slug: "project-analyst",
        description: "Provides real-time project health analysis and delivery forecasts",
        icon: "BarChart3",
        capabilities: [
          "Monitors sprint velocity and delivery trends",
          "Forecasts completion dates based on current progress",
          "Identifies at-risk milestones and dependencies",
          "Generates stakeholder-ready status reports",
        ],
        howToUse: [
          "Navigate to the Projects section",
          "Open a project and launch the Project Analyst",
          "Review the health dashboard and forecast",
          "Share the status report with your team",
        ],
        whereToFind: { label: "Projects Section", path: "/dashboard" },
      },
      {
        name: "Bug & Feature Planner",
        slug: "bug-feature-planner",
        description: "Helps triage bugs and plan feature work with AI-powered prioritization",
        icon: "Bug",
        capabilities: [
          "Triages and prioritizes incoming bugs by impact",
          "Breaks down feature requests into actionable tasks",
          "Estimates effort based on historical velocity",
          "Balances bug fixes vs. new feature development",
        ],
        howToUse: [
          "Open your project backlog",
          "Launch the Bug & Feature Planner agent",
          "Describe the bug or feature to plan",
          "Review the structured plan and add to your backlog",
        ],
        whereToFind: { label: "Projects Section", path: "/dashboard" },
      },
      {
        name: "Technical Planner",
        slug: "technical-plan-generator",
        description: "Generates detailed technical implementation plans from high-level requirements",
        icon: "Cpu",
        capabilities: [
          "Converts business requirements into technical specs",
          "Identifies architectural considerations and risks",
          "Suggests implementation approaches and trade-offs",
          "Creates developer-ready task breakdowns",
        ],
        howToUse: [
          "Navigate to the Projects section",
          "Select a requirement or epic to plan",
          "Launch the Technical Planner agent",
          "Review and refine the generated technical plan",
        ],
        whereToFind: { label: "Projects Section", path: "/dashboard" },
      },
      {
        name: "Code Reviewer",
        slug: "code-review-generator",
        description: "Generates thorough code review checklists and improvement suggestions",
        icon: "Code",
        capabilities: [
          "Creates review checklists tailored to the change type",
          "Identifies common code quality and security issues",
          "Suggests refactoring opportunities",
          "Generates PR description templates",
        ],
        howToUse: [
          "Open a project task or PR in the Projects section",
          "Launch the Code Reviewer agent",
          "Paste or describe the code to review",
          "Use the generated checklist during your code review",
        ],
        whereToFind: { label: "Projects Section", path: "/dashboard" },
      },
    ],
  },
};

export const allTeams = Object.values(agentTeams);

export function findTeamForAgent(slug: string): AgentTeamDef | undefined {
  return allTeams.find((team) => team.agents.some((a) => a.slug === slug));
}

export function findAgentBySlug(
  slug: string
): { agent: AgentTeamAgent; team: AgentTeamDef } | undefined {
  for (const team of allTeams) {
    const agent = team.agents.find((a) => a.slug === slug);
    if (agent) return { agent, team };
  }
  return undefined;
}
