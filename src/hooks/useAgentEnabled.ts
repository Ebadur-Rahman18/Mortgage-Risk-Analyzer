import { useAIAgentBySlug } from "@/hooks/useAIAgents";

/**
 * Check if a specific agent is enabled by its slug.
 * Used to feature-gate UI that depends on a particular agent being active.
 */
export function useAgentEnabled(slug: string) {
  const { data: agent, isLoading } = useAIAgentBySlug(slug);

  return {
    isEnabled: !!agent?.is_enabled,
    agent,
    isLoading,
  };
}

export const ACTION_ITEMS_AGENT_SLUG = "action-items-agent";

/** Communication Center Agent — loan communication drafts (Admin → Agents toggle). */
export const DOCUMENT_GENERATION_AGENT_SLUG = "document-generation-agent";

/** Portfolio Summary Agent — AI narrative from manager dashboard metrics. */
export const PORTFOLIO_SUMMARY_AGENT_SLUG = "portfolio-summary-agent";

/** Loan Coaching Agent — real-time AI coaching on loan detail pages. */
export const LOAN_COACHING_AGENT_SLUG = "loan-coaching-agent";

/** Underwriting Pre-Check Agent — hybrid rule + AI scorecard on loan detail. */
export const UNDERWRITER_PRECHECK_AGENT_SLUG = "underwriter-precheck-agent";

/** Pipeline Prioritization Agent — urgency-ranked loan queue. */
export const PIPELINE_PRIORITIZATION_AGENT_SLUG = "pipeline-prioritization-agent";

/** Rate Alert Intelligence Agent — monitors rate movements vs active locks. */
export const RATE_ALERT_INTELLIGENCE_AGENT_SLUG = "rate-alert-intelligence-agent";

/** Compliance Screening Agent — TRID, HMDA, Fair Lending checks per loan. */
export const COMPLIANCE_SCREENING_AGENT_SLUG = "compliance-screening-agent";

/** Branch Performance Coach Agent — weekly AI coaching digest for branch managers. */
export const BRANCH_PERFORMANCE_COACH_AGENT_SLUG = "branch-performance-coach-agent";

/** Manager Insight Agent — natural-language Q&A for manager operational views. */
export const MANAGER_INSIGHT_AGENT_SLUG = "manager-insight-agent";

/** Email Intelligence — Gmail sync, action extraction, loan linking, draft replies. */
export const EMAIL_INTELLIGENCE_AGENT_SLUG = "email-intelligence-agent";
