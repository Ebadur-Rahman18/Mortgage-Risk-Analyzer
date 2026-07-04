import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useLoan } from "@/hooks/useLoans";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useAgentEnabled, DOCUMENT_GENERATION_AGENT_SLUG, LOAN_COACHING_AGENT_SLUG, UNDERWRITER_PRECHECK_AGENT_SLUG, RATE_ALERT_INTELLIGENCE_AGENT_SLUG, COMPLIANCE_SCREENING_AGENT_SLUG } from "@/hooks/useAgentEnabled";
import { useAuth } from "@/contexts/AuthContext";
import { useLoanCoachingAgent } from "@/hooks/useLoanCoachingAgent";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Edit, Loader2, Activity, FileText, Mail, GraduationCap, MessageSquare, Database, FolderOpen, ClipboardList, Zap, Gauge, FileSignature, Bot } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { LoanTimeline } from "@/components/loans/LoanTimeline";
import { ConditionTracker } from "@/components/loans/ConditionTracker";
import { RiskBadge } from "@/components/loans/RiskBadge";
import { MilestoneTracker } from "@/components/loans/MilestoneTracker";
import { SLAStatusCard } from "@/components/loans/SLAStatusCard";
import { FileRiskAgentQuickButton } from "@/components/loans/FileRiskAgentQuickButton";
import { LoanBorrowerPortalCard } from "@/components/loans/LoanBorrowerPortalCard";
import { LoanCoachingPanel } from "@/components/loans/LoanCoachingPanel";
import { CommunicationTimeline } from "@/components/communications/CommunicationTimeline";
import { UnderwritingScorecard } from "@/components/loans/UnderwritingScorecard";
import { RateAlertCard } from "@/components/loans/RateAlertCard";
import { ComplianceChecklist } from "@/components/loans/ComplianceChecklist";
import { LoanMessagesPanel } from "@/components/loans/LoanMessagesPanel";
import { LoanDisclosuresCard } from "@/components/loans/LoanDisclosuresCard";
import { UnderwriterAssignment } from "@/components/loans/UnderwriterAssignment";
import { useDocuSignEnabled } from "@/hooks/useDocuSignEnabled";
import { useEnabledAgentBySlug } from "@/hooks/useAIAgents";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { STATUS_LABELS } from "@/lib/loan-pipeline-stages";
import { supabase } from "@/lib/supabase";
import { useModuleSettings, isModuleEnabled } from "@/hooks/useModuleSettings";
import { CreditReportSection } from "@/components/data-foundation/CreditReportSection";
import { EmploymentVerificationSection } from "@/components/data-foundation/EmploymentVerificationSection";
import { PropertyValuationSection } from "@/components/data-foundation/PropertyValuationSection";
import { AssetsSection } from "@/components/loans/application/AssetsSection";
import { LiabilitiesSection } from "@/components/loans/application/LiabilitiesSection";
import { ReoSection } from "@/components/loans/application/ReoSection";
import { DeclarationsSection } from "@/components/loans/application/DeclarationsSection";
import { LoanDocumentsPanel } from "@/components/loans/documents/LoanDocumentsPanel";
import { DocumentChecklist } from "@/components/loans/documents/DocumentChecklist";
import { EligibilityResults } from "@/components/loans/eligibility/EligibilityResults";
import { LoanClosingCostsCard } from "@/components/loans/phase3/LoanClosingCostsCard";
import { LoanComplianceRunCard } from "@/components/loans/phase3/LoanComplianceRunCard";
import { LoanQcChecklistCard } from "@/components/loans/phase3/LoanQcChecklistCard";
import { LoanAusCard } from "@/components/loans/phase3/LoanAusCard";
import { LoanHmdaCard } from "@/components/loans/phase7/LoanHmdaCard";
import { LoanBestExecutionCard } from "@/components/loans/phase4/LoanBestExecutionCard";
import { LoanRateLockCard } from "@/components/loans/phase4/LoanRateLockCard";
import { LoanInvestorSubmissionCard } from "@/components/loans/phase4/LoanInvestorSubmissionCard";
import { LoanSettlementOrdersCard } from "@/components/loans/phase5/LoanSettlementOrdersCard";
import { LoanAppraisalCard } from "@/components/loans/phase5/LoanAppraisalCard";
import { LoanRonCard } from "@/components/loans/phase5/LoanRonCard";
import { LoanDigitalClosingCard } from "@/components/loans/phase5/LoanDigitalClosingCard";
import { LoanAdverseActionCard } from "@/components/loans/phase5/LoanAdverseActionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoanPipelineContextCard } from "@/components/loans/LoanPipelineContextCard";
import { RiskCopilotPanel } from "@/components/loans/risk-copilot/RiskCopilotPanel";

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useEffectivePermissions();
  const { profile } = useAuth();
  const canUpdate = hasPermission("loans:update");
  const { data: loan, isLoading } = useLoan(id);
  const fileRiskAgent = useEnabledAgentBySlug("file-risk-agent");
  const { isEnabled: documentGenerationAgentEnabled } = useAgentEnabled(DOCUMENT_GENERATION_AGENT_SLUG);
  const { isEnabled: coachingAgentEnabled } = useAgentEnabled(LOAN_COACHING_AGENT_SLUG);
  const { isEnabled: precheckAgentEnabled } = useAgentEnabled(UNDERWRITER_PRECHECK_AGENT_SLUG);
  const { isEnabled: rateAlertAgentEnabled } = useAgentEnabled(RATE_ALERT_INTELLIGENCE_AGENT_SLUG);
  const { isEnabled: complianceAgentEnabled } = useAgentEnabled(COMPLIANCE_SCREENING_AGENT_SLUG);
  const { data: docuSignEnabled } = useDocuSignEnabled();
  const { needsAttention } = useLoanCoachingAgent(id);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [branchName, setBranchName] = useState<string | null>(null);

  // MCT Lite: gate phase-specific cards behind enabled modules so we don't
  // hit tables that were intentionally not migrated into the Lite schema.
  const { data: modules } = useModuleSettings();
  const pricingOn = isModuleEnabled(modules, "pricing");
  const complianceOn = isModuleEnabled(modules, "compliance");
  const docsOn = isModuleEnabled(modules, "document_review");
  const underwritingOn = isModuleEnabled(modules, "underwriting_queue");
  const commsOn = isModuleEnabled(modules, "communication_center");
  const phase5On = pricingOn && complianceOn; // closing/digital execution
  const workflowOn = underwritingOn || complianceOn; // SLA/milestones/conditions/timeline
  const riskCopilotOn = isModuleEnabled(modules, "mortgage_risk_copilot");


  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    const loadBranchName = async () => {
      if (!loan?.branch_id) {
        setBranchName(null);
        return;
      }
      const { data } = await supabase
        .from("branches")
        .select("name")
        .eq("id", loan.branch_id)
        .maybeSingle();
      setBranchName(data?.name ?? null);
    };
    loadBranchName();
  }, [loan?.branch_id]);

  const showCoaching = coachingAgentEnabled && isAgentAllowedForUser("loan-coaching-agent", profile);
  const showPrecheck = precheckAgentEnabled && isAgentAllowedForUser("underwriter-precheck-agent", profile);
  const showRateAlert = rateAlertAgentEnabled && isAgentAllowedForUser("rate-alert-intelligence-agent", profile);
  const showCompliance = complianceAgentEnabled && isAgentAllowedForUser("compliance-screening-agent", profile);

  const handleChatWithAgent = (agentSlug: string) => {
    if (!loan) return;
    const loanContext = {
      loan_id: loan.id,
      loan_number: loan.loan_number,
      status: loan.status,
      loan_amount: loan.loan_amount,
      borrower_name: borrowerName,
    };
    navigate(`/agents/${agentSlug}`, { state: { loanContext } });
  };

  if (isLoading || !loan) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rawBorrower = loan.borrowers;
  const borrower: { first_name?: string; last_name?: string; email?: string } | undefined = Array.isArray(rawBorrower)
    ? rawBorrower[0]
    : rawBorrower ?? undefined;
  const borrowerName = borrower
    ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "—"
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/loans">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{loan.loan_number}</h1>
              <RiskBadge loanId={loan.id} showScore />
              {fileRiskAgent && <FileRiskAgentQuickButton loan={loan} />}
              {documentGenerationAgentEnabled && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/communication-center?loanId=${loan.id}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Generate document
                  </Link>
                </Button>
              )}
              {showCoaching && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCoachingOpen(true)}
                  className={cn(
                    "gap-2 relative",
                    needsAttention && "border-emerald-500 text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  <GraduationCap className="h-4 w-4" />
                  Loan Coach
                  {needsAttention && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                  )}
                </Button>
              )}
              {isAgentAllowedForUser("daily-action-agent", profile) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChatWithAgent("daily-action-agent")}
                  className="gap-2"
                >
                  <Bot className="h-4 w-4" />
                  AI Chat
                </Button>
              )}
            </div>
            <p className="text-muted-foreground">
              {borrowerName} · {STATUS_LABELS[loan.status] ?? loan.status}
            </p>
          </div>
        </div>
        {canUpdate && (
          <Button asChild>
            <Link to={`/loans/${loan.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Loan
            </Link>
          </Button>
        )}
      </div>

      {/* ── Underwriter Assignment ─────────────────────────────────── */}
      {canUpdate && (
        <UnderwriterAssignment loanId={loan.id} currentUnderwriterId={loan.underwriter_id ?? null} />
      )}

      {/* ── Loan Overview ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b pb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Loan Overview
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan details</CardTitle>
            <CardDescription>Amounts and key metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label="Status" value={STATUS_LABELS[loan.status] ?? loan.status} />
            <Row
              label="Loan amount"
              value={
                loan.loan_amount != null
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    }).format(Number(loan.loan_amount))
                  : "—"
              }
            />
            <Row
              label="Appraised value"
              value={
                loan.appraised_value != null
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    }).format(Number(loan.appraised_value))
                  : "—"
              }
            />
            <Row label="LTV" value={loan.ltv != null ? `${Number(loan.ltv)}%` : "—"} />
            <Row label="Credit score" value={loan.credit_score ?? "—"} />
            <Row label="DTI" value={loan.dti != null ? `${Number(loan.dti)}%` : "—"} />
            <Row label="Purpose" value={loan.purpose ?? "—"} />
            <Row label="Occupancy" value={loan.occupancy_type ?? "—"} />
            <Row label="Lock date" value={loan.lock_date ? formatDate(loan.lock_date) : "—"} />
            <Row label="Lock expiration" value={loan.lock_expiration_date ? formatDate(loan.lock_expiration_date) : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property &amp; source</CardTitle>
            <CardDescription>Address and data source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label="Borrower" value={borrowerName} />
            <Row label="Property address" value={loan.property_address ?? "—"} />
            <Row label="City" value={loan.property_city ?? "—"} />
            <Row label="State" value={loan.property_state ?? "—"} />
            <Row label="Postal code" value={loan.property_postal_code ?? "—"} />
            <Row label="Branch" value={branchName ?? "—"} />
            <Row label="Data source" value={loan.data_source ?? "manual"} />
            <Row label="Created" value={formatDate(loan.created_at)} />
          </CardContent>
        </Card>
      </div>

      <LoanPipelineContextCard
        status={loan.status}
        createdAt={loan.created_at}
        updatedAt={loan.updated_at}
        lockDate={loan.lock_date}
      />

      {riskCopilotOn && <RiskCopilotPanel loanId={loan.id} />}

      {/* ── Rate Intelligence ──────────────────────────────────────── */}
      {pricingOn && showRateAlert && <RateAlertCard loanId={loan.id} />}


      {/* ── Data Foundation (Credit, Employment, Property) ──────── */}
      {underwritingOn && loan.borrower_id && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Data Foundation
            </h2>
          </div>
          <Tabs defaultValue="credit" className="space-y-4">
            <TabsList>
              <TabsTrigger value="credit">Credit</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="property">Property Valuation</TabsTrigger>
            </TabsList>
            <TabsContent value="credit">
              <CreditReportSection borrowerId={loan.borrower_id} loanId={loan.id} />
            </TabsContent>
            <TabsContent value="employment">
              <EmploymentVerificationSection borrowerId={loan.borrower_id} loanId={loan.id} />
            </TabsContent>
            <TabsContent value="property">
              <PropertyValuationSection
                borrowerId={loan.borrower_id}
                loanId={loan.id}
                defaultAddress={loan.property_address ?? undefined}
                defaultCity={loan.property_city ?? undefined}
                defaultState={loan.property_state ?? undefined}
                defaultPostalCode={loan.property_postal_code ?? undefined}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── Application Data (1003) ─────────────────────────────────── */}
      {underwritingOn && loan.borrower_id && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Application Data
            </h2>
          </div>
          <Tabs defaultValue="assets" className="space-y-4">
            <TabsList>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
              <TabsTrigger value="reo">Real Estate Owned</TabsTrigger>
              <TabsTrigger value="declarations">Declarations</TabsTrigger>
            </TabsList>
            <TabsContent value="assets">
              <AssetsSection loanId={loan.id} borrowerId={loan.borrower_id} />
            </TabsContent>
            <TabsContent value="liabilities">
              <LiabilitiesSection loanId={loan.id} borrowerId={loan.borrower_id} />
            </TabsContent>
            <TabsContent value="reo">
              <ReoSection loanId={loan.id} borrowerId={loan.borrower_id} />
            </TabsContent>
            <TabsContent value="declarations">
              <DeclarationsSection loanId={loan.id} borrowerId={loan.borrower_id} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── Documents ─────────────────────────────────────────────── */}
      {docsOn && (
        <>
          <div id="loan-documents" className="flex items-center gap-2 border-b pb-2 scroll-mt-24">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Documents
            </h2>
          </div>

          <DocumentChecklist loanId={loan.id} programId={loan.program_id} />
          <LoanDocumentsPanel loanId={loan.id} borrowerId={loan.borrower_id ?? undefined} />
        </>
      )}

      {/* ── Eligibility ───────────────────────────────────────────── */}
      {complianceOn && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Eligibility
            </h2>
          </div>
          <EligibilityResults loanId={loan.id} />
        </>
      )}


      {/* ── Phase 3: Pricing & compliance (fees, rules, QC, AUS) ───── */}
      {(pricingOn || complianceOn) && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pricing, fees &amp; compliance
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {pricingOn && (
              <LoanClosingCostsCard loanId={loan.id} loanAmount={loan.loan_amount != null ? Number(loan.loan_amount) : null} />
            )}
            {complianceOn && <LoanComplianceRunCard loanId={loan.id} />}
            {complianceOn && <LoanQcChecklistCard loanId={loan.id} canEdit={canUpdate} />}
            {complianceOn && <LoanAusCard loanId={loan.id} />}
            {complianceOn && <LoanHmdaCard loanId={loan.id} />}
            {pricingOn && <LoanBestExecutionCard loanId={loan.id} />}
            {pricingOn && <LoanRateLockCard loanId={loan.id} />}
            {pricingOn && <LoanInvestorSubmissionCard loanId={loan.id} />}
          </div>
        </>
      )}

      {/* ── Phase 5: Closing & digital execution ───────────────────── */}
      {phase5On && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Closing &amp; digital execution
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <LoanSettlementOrdersCard loanId={loan.id} />
            <LoanAppraisalCard loanId={loan.id} />
            <LoanRonCard loanId={loan.id} />
            <LoanDigitalClosingCard loanId={loan.id} />
            <LoanAdverseActionCard
              loanId={loan.id}
              loanNumber={loan.loan_number ?? ""}
              applicantLabel={borrowerName !== "—" ? borrowerName : "Applicant"}
            />
          </div>
        </>
      )}


      {/* ── Workflow Management ─────────────────────────────────────── */}
      {workflowOn && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Workflow Management
            </h2>
          </div>

          <SLAStatusCard loanId={loan.id} loanStatus={loan.status} />

          <LoanBorrowerPortalCard loanId={loan.id} borrowerEmail={borrower?.email} />

          <MilestoneTracker loanId={loan.id} loanStatus={loan.status} />

          <ConditionTracker loanId={loan.id} loanStatus={loan.status} />

          {showPrecheck && (
            <UnderwritingScorecard
              loanId={loan.id}
              loanNumber={loan.loan_number}
              borrowerName={borrowerName !== "—" ? borrowerName : undefined}
            />
          )}

          {showCompliance && (
            <ComplianceChecklist
              loanId={loan.id}
              loanNumber={loan.loan_number}
              borrowerName={borrowerName !== "—" ? borrowerName : undefined}
            />
          )}

          <LoanTimeline loanId={loan.id} loanStatus={loan.status} />
        </>
      )}

      {commsOn && (
        <CommunicationTimeline loanId={loan.id} title="Borrower Communications" />
      )}

      {/* ── Borrower Portal ──────────────────────────────────────── */}
      {commsOn && (
        <>
          <div className="flex items-center gap-2 border-b pb-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Borrower Portal
            </h2>
          </div>

          {loan.borrower_id && (
            <LoanMessagesPanel loanId={loan.id} borrowerId={loan.borrower_id} />
          )}

          {docuSignEnabled && loan.borrower_id && (
            <LoanDisclosuresCard loanId={loan.id} borrowerId={loan.borrower_id} />
          )}
        </>
      )}

      {/* Loan Coaching Agent side-panel */}
      {showCoaching && id && (
        <LoanCoachingPanel
          loanId={id}
          open={coachingOpen}
          onOpenChange={setCoachingOpen}
        />
      )}
    </div>
  );
}


function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
