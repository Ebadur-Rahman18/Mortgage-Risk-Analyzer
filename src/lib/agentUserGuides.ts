/**
 * In-app user guides for AI agents (Admin / AI Agents page help dialog).
 * Keys align with `AGENT_ALLOWED_ROLES_BY_SLUG` in agentRoles.ts.
 */

import { AGENT_ALLOWED_ROLES_BY_SLUG } from "@/lib/agentRoles";

export interface AgentUserGuideStep {
  title: string;
  detail?: string;
  /** In-app path for navigation hint */
  path?: string;
}

export interface AgentUserGuide {
  summary: string;
  steps: AgentUserGuideStep[];
}

function humanizeRoleToken(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/_/g, " ");
  if (!s) return raw;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Single line for the help dialog: who may use this agent per product policy.
 */
export function formatAllowedRolesLine(slug: string): string {
  if (!(slug in AGENT_ALLOWED_ROLES_BY_SLUG)) {
    return "Not listed in the central role map — confirm access with an administrator.";
  }
  const allowed = AGENT_ALLOWED_ROLES_BY_SLUG[slug];
  if (allowed === null) {
    return "All signed-in users (subject to module and route permissions).";
  }
  return allowed.map(humanizeRoleToken).join(", ");
}

const GUIDES: Record<string, AgentUserGuide> = {
  "loan-coaching-agent": {
    summary:
      "Loan Coaching gives you conversational help on one loan at a time: what to do next, how to phrase requests to borrowers or partners, and plain-language explanations of status and conditions. It is meant to be used while you are actively working the file\u2014not as a substitute for your LOS or underwriting policy. The agent must be enabled in Admin \u2192 AI Agents, and you need access to the loan in the app.",
    steps: [
      {
        title: "Confirm access and enablement",
        detail:
          "Your role (loan officer, branch manager, moderator, or admin) must be allowed to use this agent. If the coaching panel is missing, ask an admin to enable \u201cLoan Coaching\u201d / loan-coaching-agent and confirm you can open the loan.",
        path: "/admin/agents",
      },
      {
        title: "Go to the loan list and open a file",
        detail:
          "Use search or filters to find the borrower or loan number. Open the loan detail page\u2014that is where coaching context (status, conditions, documents) is available to the AI.",
        path: "/loans",
      },
      {
        title: "Locate the Loan Coaching / AI section",
        detail:
          "On the loan detail screen, scroll to the coaching or AI panel (wording may vary). It only appears when the agent is enabled for your tenant.",
        path: "/loans",
      },
      {
        title: "Ask focused questions",
        detail:
          "Good prompts mention specifics: e.g. \u201cWhat should I request for the last appraisal condition?\u201d or \u201cSummarize what\u2019s blocking clear to close.\u201d Avoid vague \u201chelp me\u201d without loan context.",
      },
      {
        title: "Use the answers as guidance only",
        detail:
          "Treat outputs as suggestions. Verify against your investor guides, overlays, and internal policy before taking action or communicating to borrowers.",
      },
    ],
  },
  "underwriter-precheck-agent": {
    summary:
      "Underwriting Pre-Check combines rules and AI to produce a scorecard-style view on a single loan: strengths, gaps, and risk-oriented signals before or during formal underwriting. It helps loan teams prioritize conditions and documentation\u2014not a final credit decision. Results appear on the loan detail page for allowed roles when the agent is on.",
    steps: [
      {
        title: "Prerequisites",
        detail:
          "Enable underwriter-precheck-agent in Admin \u2192 AI Agents. You typically need loan officer, branch manager, moderator, or admin access, plus permission to view the loan.",
        path: "/admin/agents",
      },
      {
        title: "Navigate to the loan",
        detail:
          "From Loans, open the file you want to evaluate. Pre-check uses data visible on that loan in Control Tower (not a full duplicate of your LOS).",
        path: "/loans",
      },
      {
        title: "Run or open the Pre-Check / scorecard UI",
        detail:
          "On loan detail, find the Underwriting Pre-Check or scorecard section. Launch or refresh the analysis so it reflects current loan data.",
        path: "/loans",
      },
      {
        title: "Read the output in context",
        detail:
          "Note flagged items, suggested conditions, or risk hints. Cross-check with your actual underwriting findings and system of record.",
      },
      {
        title: "Iterate as the file changes",
        detail:
          "After new documents or status changes, run again if the UI allows so the snapshot stays aligned with the pipeline stage.",
      },
    ],
  },
  "pipeline-prioritization-agent": {
    summary:
      "Pipeline Prioritization helps you see which loans deserve attention first\u2014based on urgency signals such as aging, deadlines, lock windows, or risk. Loan officers use it from the main loan queue; managers may see related context on the pipeline dashboard. It does not replace your task list or calendar; it complements them.",
    steps: [
      {
        title: "Enable the agent",
        detail:
          "An admin must enable pipeline-prioritization-agent. Your role must be in the allowed list (e.g. loan officer, branch manager, moderator, admin).",
        path: "/admin/agents",
      },
      {
        title: "Start on the Loans page",
        detail:
          "Open the loan list. When prioritization is active, look for urgency indicators, sort options, or highlighted rows (exact UI depends on your build).",
        path: "/loans",
      },
      {
        title: "Triage top-ranked files",
        detail:
          "Work from the top of the priority view: contact borrowers, clear conditions, or escalate stale files before lower-ranked loans.",
      },
      {
        title: "Managers: use the Pipeline dashboard",
        detail:
          "Branch managers and admins can review branch-level pipeline health and align team focus with the same prioritization logic where exposed.",
        path: "/pipeline",
      },
      {
        title: "Combine with Action Items",
        detail:
          "Pair prioritized loans with tasks on Action Items so follow-ups are tracked, not only viewed once in the list.",
        path: "/action-items",
      },
    ],
  },
  "file-risk-agent": {
    summary:
      "File Risk analyzes documents tied to a loan for quality and consistency issues: missing pages, unclear images, possible mismatches, or other red flags that slow underwriting. You can open it from the loan list shortcut or from a loan\u2019s detail view. Use it before submitting to underwriting or when recycling conditions.",
    steps: [
      {
        title: "Ensure uploads exist",
        detail:
          "Upload relevant documents to the loan so the agent has something to analyze. Empty or stale folders limit usefulness.",
        path: "/loans",
      },
      {
        title: "Open File Risk from Loans or Loan detail",
        detail:
          "From /loans you may have a deep link or banner to File Risk for certain flows; otherwise open the loan and use the File Risk panel when the agent is enabled.",
        path: "/loans",
      },
      {
        title: "Run the analysis",
        detail:
          "Trigger the scan and wait for completion. Review each flagged item: severity, document name, and suggested follow-up.",
      },
      {
        title: "Fix or re-upload",
        detail:
          "Obtain clearer scans, add missing pages, or update the borrower request. Re-run File Risk after material changes.",
      },
      {
        title: "Document outcomes in conditions",
        detail:
          "Use your normal condition workflow to mark items satisfied once underwriting accepts the file.",
        path: "/action-items",
      },
    ],
  },
  "portfolio-summary-agent": {
    summary:
      "Portfolio Summary turns pipeline metrics into a short narrative for managers: health of the book, trends, and talking points for standups or leadership. It is aimed at branch managers and admins who use the Manager / Pipeline dashboard\u2014not at loan-level edits. Refresh when you need an updated story for a meeting or report.",
    steps: [
      {
        title: "Role and module access",
        detail:
          "Typically admin, moderator, or branch manager. You need access to the pipeline / manager dashboard and the agent enabled in Admin.",
        path: "/admin/agents",
      },
      {
        title: "Open the Pipeline (Manager) dashboard",
        detail:
          "Go to the pipeline view where portfolio KPIs and charts load. The summary reads from data available in that context.",
        path: "/pipeline",
      },
      {
        title: "Find the Portfolio Summary block",
        detail:
          "Locate the AI portfolio summary section. Generate or refresh to pull the latest metrics into a narrative.",
        path: "/pipeline",
      },
      {
        title: "Use the narrative carefully",
        detail:
          "Copy or paraphrase for internal meetings. Numbers should still be validated against official reports if used for decisions.",
      },
    ],
  },
  "action-items-agent": {
    summary:
      "The Action Items agent powers task creation and AI-assisted suggestions: daily priorities, follow-ups from workflows, and (where integrated) tasks extracted from email or other modules. The Action Items page is the hub for viewing, assigning, and completing work. All authenticated users typically see it unless your tenant restricts it.",
    steps: [
      {
        title: "Open Action Items from the sidebar",
        detail:
          "Use the main navigation entry for Action Items. If it is hidden, confirm the module is on and your permissions include tasks.",
        path: "/action-items",
      },
      {
        title: "Review the default list",
        detail:
          "Scan what is assigned to you, due soon, or high priority. Filters help focus on loan-linked vs general tasks.",
      },
      {
        title: "Create or generate items",
        detail:
          "Add tasks manually, or use AI flows elsewhere (e.g. Email Intelligence \u201cCreate action items\u201d) that insert rows with source metadata when configured.",
        path: "/action-items",
      },
      {
        title: "Link work to loans when relevant",
        detail:
          "Attach a loan so reporting and loan detail views stay consistent with your pipeline.",
        path: "/loans",
      },
      {
        title: "Close the loop",
        detail:
          "Mark complete, reassign, or set new due dates so the list stays trustworthy for the team.",
      },
    ],
  },
  "document-generation-agent": {
    summary:
      "Communication Center helps you draft borrower-ready language: emails, letters, and explanations grounded in loan context. It does not send mail by itself-you copy, review for compliance, and send through your approved channel (e.g. Gmail or LOS). The agent must be enabled for the menu to appear for your role.",
    steps: [
      {
        title: "Open Communication Center",
        detail:
          "Navigate to Communication Center from the sidebar. If missing, enable document-generation-agent in Admin and confirm module access.",
        path: "/communication-center",
      },
      {
        title: "Select loan or scenario context",
        detail:
          "Pick the loan or template flow the UI offers so prompts include borrower name, property, and stage-appropriate tone.",
        path: "/communication-center",
      },
      {
        title: "Generate a first draft",
        detail:
          "Run the agent with a clear intent: e.g. \u201cExplain delay in appraisal\u201d or \u201cRequest updated bank statements.\u201d Edit tone to match your brand.",
      },
      {
        title: "Compliance and policy review",
        detail:
          "Have a licensed or designated reviewer ensure disclosures and wording meet TRID, fair lending, and investor rules before sending.",
      },
      {
        title: "Send outside the app",
        detail:
          "Paste into email or export as required. Outbound sending is not automatic from this screen unless integrated separately.",
      },
    ],
  },
  "rate-alert-intelligence-agent": {
    summary:
      "Rate Alert Intelligence compares market or pricing movement to each loan\u2019s lock (or lock strategy) so you can renegotiate, extend, or communicate before the borrower is surprised. Signals appear in loan context for eligible roles. It supports decision support, not live pricing engines\u2014confirm rates with your pricing desk or LOS.",
    steps: [
      {
        title: "Enable and open the loan",
        detail:
          "Confirm rate-alert-intelligence-agent is on. Open the loan from the list.",
        path: "/loans",
      },
      {
        title: "Review lock and timeline fields",
        detail:
          "Ensure lock expiration and program data in the app are current so alerts are meaningful.",
        path: "/loans",
      },
      {
        title: "Use the Rate Alert section on loan detail",
        detail:
          "Read the alert or narrative. Decide whether to float/downgrade pricing, extend the lock, or contact the borrower.",
        path: "/loans",
      },
      {
        title: "Coordinate with pricing / lock desk",
        detail:
          "Execute real lock changes in your system of record; use Control Tower as awareness, not the sole authority.",
      },
    ],
  },
  "compliance-screening-agent": {
    summary:
      "Compliance Screening surfaces TRID-, HMDA-, and fair-lending-oriented prompts and checks for managerial review on a loan. It assists oversight and training\u2014not legal advice. Restricted to admin, moderator, and branch manager roles in policy; use it before audits or when coaching file quality.",
    steps: [
      {
        title: "Confirm role access",
        detail:
          "If you do not see compliance tools on loan detail, your profile may not include branch manager (or equivalent) or admin paths.",
        path: "/admin/roles",
      },
      {
        title: "Open the loan file",
        detail:
          "Navigate from Loans into the loan that needs a compliance pass.",
        path: "/loans",
      },
      {
        title: "Run or read Compliance Screening",
        detail:
          "Open the compliance section, run screening if applicable, and walk through each flagged theme.",
        path: "/loans",
      },
      {
        title: "Document remediation",
        detail:
          "Assign fixes to processors or LOs, track in conditions or action items, and retain evidence for audit.",
        path: "/action-items",
      },
      {
        title: "Escalate legal questions",
        detail:
          "When in doubt, involve compliance or legal rather than relying solely on AI output.",
      },
    ],
  },
  "branch-performance-coach-agent": {
    summary:
      "Branch Performance Coach delivers periodic, AI-assisted coaching for branch managers: themes from your pipeline (velocity, pull-through, stale deals), suggested talking points for one-on-ones, and focus areas for the week. It lives on the Pipeline / Manager dashboard alongside other manager widgets. Use it to prepare conversations\u2014not as HR or performance review by itself.",
    steps: [
      {
        title: "Access the manager dashboard",
        detail:
          "Log in as branch manager, moderator, or admin. Open the Pipeline dashboard where branch metrics load.",
        path: "/pipeline",
      },
      {
        title: "Locate the coaching digest",
        detail:
          "Find the Branch Performance Coach block (wording may vary). Ensure branch-performance-coach-agent is enabled in Admin.",
        path: "/pipeline",
      },
      {
        title: "Read the latest digest",
        detail:
          "Note trends, risks, and recommended coaching prompts for your team.",
      },
      {
        title: "Prepare 1:1s or team meetings",
        detail:
          "Use bullets as agendas; combine with real LOS metrics and HR processes.",
      },
      {
        title: "Track follow-through",
        detail:
          "Convert themes into Action Items or internal goals so coaching turns into measurable follow-up.",
        path: "/action-items",
      },
    ],
  },
  "manager-insight-agent": {
    summary:
      "Manager Insight is a natural-language layer on top of manager views: ask about stale loans, bottlenecks by stage, workload by officer, or pipeline velocity in plain English. It is available on the Pipeline / Manager dashboard when enabled. Answers depend on data visible in Control Tower; verify critical numbers in reporting or the LOS.",
    steps: [
      {
        title: "Open the Pipeline / Manager dashboard",
        detail:
          "Managers and admins land here for branch or org context. Enable manager-insight-agent in Admin first.",
        path: "/pipeline",
      },
      {
        title: "Find the Manager Insight or Q&A entry point",
        detail:
          "Use the chat or question box provided for this agent (exact placement follows your UI).",
        path: "/pipeline",
      },
      {
        title: "Ask specific operational questions",
        detail:
          "Examples: \u201cWhich loans have no activity in 14 days?\u201d \u201cWho has the largest underwriting queue?\u201d \u201cWhat stage is slowing us down most?\u201d",
        path: "/pipeline",
      },
      {
        title: "Iterate with filters in mind",
        detail:
          "If an answer is vague, narrow the question by branch, officer, or date range as the UI allows.",
      },
      {
        title: "Validate before acting",
        detail:
          "Use insight to direct attention; confirm counts and borrower details in the loan list before outreach.",
        path: "/loans",
      },
    ],
  },
  "email-intelligence-agent": {
    summary:
      "Email Intelligence connects your Gmail (read-only OAuth), syncs recent messages into Control Tower, and lets you extract structured action items, link threads to loans, and draft replies. Sending email from the app is optional and often disabled in demo: you copy drafts into Gmail. You need the loans module, this agent enabled in Admin, and Google OAuth configured for your environment.",
    steps: [
      {
        title: "Prerequisites",
        detail:
          "Admin enables email-intelligence-agent. Google Cloud OAuth (client ID/secret) and redirect URI must match your app URL. Users complete Google consent (test users or verified app).",
        path: "/admin/agents",
      },
      {
        title: "Go to Email Intelligence",
        detail:
          "Open the page from the sidebar under loans-related tools. If hidden, check agent toggle and loans:read permission.",
        path: "/email-intelligence",
      },
      {
        title: "Connect Gmail once per user",
        detail:
          "Click Connect, sign in with Google, approve read-only access. Tokens are stored for sync\u2014disconnect if you need to revoke.",
        path: "/email-intelligence",
      },
      {
        title: "Sync messages",
        detail:
          "Run Sync to pull recent inbox mail into the list. Wait for completion; large mailboxes may take longer.",
        path: "/email-intelligence",
      },
      {
        title: "Select a message and optional loan link",
        detail:
          "Click a thread, set Link to loan if you want tasks tied to a file, then read body and attachments.",
        path: "/email-intelligence",
      },
      {
        title: "Extract action items",
        detail:
          "Run Extract actions; review JSON output, then Create action items to insert tasks (loan IDs resolve when possible).",
        path: "/email-intelligence",
      },
      {
        title: "Draft a reply",
        detail:
          "Run Draft reply for suggested text. Copy into Gmail to send; outbound send from Control Tower may not be enabled in demo.",
        path: "/email-intelligence",
      },
    ],
  },
};

export function getAgentUserGuide(slug: string): AgentUserGuide | null {
  return GUIDES[slug] ?? null;
}

export function getFallbackGuide(agent: {
  name: string;
  description: string | null;
  slug: string;
}): AgentUserGuide {
  const desc = (agent.description ?? "").trim();
  return {
    summary: desc
      ? `This is a custom or tenant-specific agent ("${agent.name}"). The description below was entered in Admin; the product may also wire it into chats, loan flows, or edge functions that are not listed in the built-in guide. Read the description carefully, then use Chat to experiment. Always follow your organization's compliance and approval process before acting on AI output.`
      : `No long-form guide exists yet for "${agent.name}" (${agent.slug}). Treat it as a custom agent: discover behavior through Chat and your administrator's documentation.`,
    steps: [
      {
        title: "Read the agent card and Admin description",
        detail:
          desc
            ? `Admin description: ${desc}`
            : "Ask an admin to add a clear description in AI Agents so everyone knows the intended use case.",
        path: "/admin/agents",
      },
      {
        title: "Enable and open Chat",
        detail:
          "On this page, ensure the agent is enabled, then use Chat to try prompts with safe, non-PII test data first if unsure.",
      },
      {
        title: "Ask your admin about scope",
        detail:
          "Confirm which roles may use it, whether it calls edge functions or tools, and any data it may access.",
      },
      {
        title: "Validate outputs",
        detail:
          "Do not rely on custom agents for regulatory or credit decisions without human review and your official systems of record.",
      },
    ],
  };
}
