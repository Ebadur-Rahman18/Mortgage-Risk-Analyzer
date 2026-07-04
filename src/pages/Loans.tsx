// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLoans, LOANS_PAGE_SIZE } from "@/hooks/useLoans";
import { fetchPipelineLoansWithRisk } from "@/lib/loan-export-queries";
import { useHideDemoData } from "@/hooks/useHideDemoData";
import {
  exportLoanPipelineToCSV,
  exportLoanPipelineToExcel,
  pipelineExportFilename,
} from "@/lib/loan-export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Search, Edit, Eye, Link2, Download, Loader2, List, Zap, ArrowLeft } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { FileRiskAgentPanel } from "@/components/loans/FileRiskAgentPanel";
import { useEnabledAgentBySlug } from "@/hooks/useAIAgents";
import { RiskBadge } from "@/components/loans/RiskBadge";
import { CopilotRiskBadge } from "@/components/loans/risk-copilot/CopilotRiskBadge";
import { useModuleSettings, isModuleEnabled } from "@/hooks/useModuleSettings";
import { useIntegrationSetting } from "@/hooks/useIntegrationSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRiskAlerts } from "@/hooks/useRiskAlerts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Loan } from "@/hooks/useLoans";
import { PIPELINE_STAGE_SELECT_OPTIONS } from "@/lib/loan-pipeline-stages";
import { PriorityQueueView } from "@/components/loans/PriorityQueueView";
import { useAgentEnabled, PIPELINE_PRIORITIZATION_AGENT_SLUG, RATE_ALERT_INTELLIGENCE_AGENT_SLUG } from "@/hooks/useAgentEnabled";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { useAuth } from "@/contexts/AuthContext";
import { useRateAlertSummary } from "@/hooks/useRateAlertIntelligence";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ManagerDashboard from "./ManagerDashboard";

function borrowerDisplay(loan: Loan & { borrowers?: { first_name?: string; last_name?: string; email?: string } | null }) {
  const b = loan.borrowers;
  if (!b) return loan.borrower_id;
  const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
  return name;
}

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function Loans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [status, setStatus] = useState<string>(() => searchParams.get("status") ?? "");
  const [loanType, setLoanType] = useState<string>(() => searchParams.get("loanType") ?? "");
  const [riskLevel, setRiskLevel] = useState<string>(() => searchParams.get("riskLevel") ?? "");
  const [view, setView] = useState<"list" | "priority">("list");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<null | "csv" | "xls">(null);
  const [fileRiskPanelOpen, setFileRiskPanelOpen] = useState(false);
  const { hasPermission } = useEffectivePermissions();
  const { profile } = useAuth();
  const { isEnabled: priorityAgentEnabled } = useAgentEnabled(PIPELINE_PRIORITIZATION_AGENT_SLUG);
  const { isEnabled: rateAlertAgentEnabled } = useAgentEnabled(RATE_ALERT_INTELLIGENCE_AGENT_SLUG);
  const showPriority = priorityAgentEnabled && isAgentAllowedForUser("pipeline-prioritization-agent", profile);
  const showRateAlerts = rateAlertAgentEnabled && isAgentAllowedForUser("rate-alert-intelligence-agent", profile);
  const canCreate = hasPermission("loans:create");
  const canUpdate = hasPermission("loans:update");
  const canExport =
    hasPermission("loans:read") ||
    hasPermission("loans:export");

  const { data: loansResult, isLoading } = useLoans({
    search: search || undefined,
    status: status || undefined,
    loanType: loanType || undefined,
    riskLevel: riskLevel || undefined,
    page: view === "list" ? page : undefined,
  });
  const loans = loansResult?.rows ?? [];
  const totalCount = loansResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / LOANS_PAGE_SIZE));
  const hideDemo = useHideDemoData();
  const { data: losIntegration } = useIntegrationSetting("lendingpad");
  const { data: modules } = useModuleSettings();
  const riskCopilotOn = isModuleEnabled(modules, "mortgage_risk_copilot");
  const { data: hubspotIntegration } = useIntegrationSetting("hubspot");
  const { data: encompassIntegration } = useIntegrationSetting("encompass");
  const { data: riskAlerts } = useRiskAlerts("unread");
  const fileRiskAgent = useEnabledAgentBySlug("file-risk-agent");
  const { data: rateAlertSummary } = useRateAlertSummary();
  const createdDaysParam = Number(searchParams.get("createdDays") ?? 0);
  const lockExpiresDaysParam = Number(searchParams.get("lockExpiresDays") ?? 0);

  const alertsList = Array.isArray(riskAlerts) ? riskAlerts : [];
  const criticalCount = alertsList.filter((a) => a.severity === "critical").length;
  const highCount = alertsList.filter((a) => a.severity === "high").length;

  useEffect(() => {
    const shouldOpenFileRisk = searchParams.get("open") === "file-risk-agent";
    if (!shouldOpenFileRisk) return;
    setFileRiskPanelOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("open");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const filteredLoans = useMemo(() => {
    const rows = loans;
    const now = new Date();

    return rows.filter((loan) => {
      if (createdDaysParam > 0) {
        const createdCutoff = new Date(now);
        createdCutoff.setDate(createdCutoff.getDate() - createdDaysParam);
        if (new Date(loan.created_at) < createdCutoff) return false;
      }

      if (lockExpiresDaysParam > 0) {
        if (!loan.lock_expiration_date) return false;
        if (["closed", "denied", "withdrawn"].includes(loan.status)) return false;
        const lockExpiry = new Date(loan.lock_expiration_date);
        const lockCutoff = new Date(now);
        lockCutoff.setDate(lockCutoff.getDate() + lockExpiresDaysParam);
        if (lockExpiry < now || lockExpiry > lockCutoff) return false;
      }

      return true;
    });
  }, [loans, createdDaysParam, lockExpiresDaysParam]);

  async function runExport(format: "csv" | "xls") {
    if (!canExport) return;
    setExporting(format);
    try {
      const rows = await fetchPipelineLoansWithRisk({
        search: search || undefined,
        status: status || undefined,
        hideDemo,
      });
      if (rows.length === 0) {
        toast.message("No loans match the current filters to export.");
        return;
      }
      const base = pipelineExportFilename("pipeline-loans");
      if (format === "csv") exportLoanPipelineToCSV(rows, base);
      else exportLoanPipelineToExcel(rows, base);
      toast.success(`Exported ${rows.length} loan(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      {(criticalCount > 0 || highCount > 0) && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="flex items-center gap-3">
            <span className="font-medium">Risk Alerts:</span>
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                {highCount} high
              </span>
            )}
            <span className="text-xs">— Check the risk alerts bell for details.</span>
          </AlertDescription>
        </Alert>
      )}

      {showRateAlerts && rateAlertSummary && rateAlertSummary.total > 0 && (
        <Alert className="py-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
          <AlertDescription className="flex items-center gap-3">
            <span className="font-medium">Rate Alerts:</span>
            {rateAlertSummary.at_risk > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {rateAlertSummary.at_risk} at risk
              </span>
            )}
            {rateAlertSummary.float_down > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {rateAlertSummary.float_down} float-down
              </span>
            )}
            <span className="text-xs">— Open individual loans to see details and take action.</span>
          </AlertDescription>
        </Alert>
      )}

      {losIntegration && (
        <Alert className="py-2">
          <Link2 className="h-4 w-4" />
          <AlertDescription>
            {losIntegration.is_active ? (
              <>LendingPad LOS is connected. Loans and conditions can be synced automatically.</>
            ) : losIntegration.api_key ? (
              <>LendingPad LOS is configured but disabled. Contact your administrator to enable sync.</>
            ) : (
              <>LOS (LendingPad) is not configured. Contact your administrator to enable loan sync from your LOS.</>
            )}
          </AlertDescription>
        </Alert>
      )}
      {(hubspotIntegration || encompassIntegration) && (
        <Alert className="py-2">
          <Link2 className="h-4 w-4" />
          <AlertDescription>
            {[
              hubspotIntegration
                ? hubspotIntegration.is_active
                  ? "HubSpot sync is connected and active."
                  : hubspotIntegration.api_key
                    ? "HubSpot is configured but disabled."
                    : "HubSpot is not configured."
                : null,
              encompassIntegration
                ? encompassIntegration.is_active
                  ? "Encompass sync is connected and active."
                  : encompassIntegration.api_key
                    ? "Encompass is configured but disabled."
                    : "Encompass is not configured."
                : null,
            ]
              .filter(Boolean)
              .join(" ")}{" "}
            Pipeline sync values are imported from enabled integrations.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
            <p className="text-muted-foreground">
              Manage loan applications (manual entry and API sync-ready)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v === "list" || v === "priority") setView(v);
            }}
            variant="outline"
            size="sm"
            className="border border-input bg-background"
            aria-label="Loans view mode"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="mr-1.5 h-4 w-4" />
              List
            </ToggleGroupItem>
            {showPriority && (
              <ToggleGroupItem value="priority" aria-label="Priority queue view">
                <Zap className="mr-1.5 h-4 w-4" />
                Priority
              </ToggleGroupItem>
            )}
          </ToggleGroup>
          {hasPermission("loans:import") && (
            <Button variant="outline" asChild>
              <Link to="/loans/import">Import CSV</Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link to="/loans/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Loan
              </Link>
            </Button>
          )}
        </div>
      </div>

      {fileRiskAgent && (
        <div>
          <FileRiskAgentPanel
            loans={filteredLoans}
            open={fileRiskPanelOpen}
            onOpenChange={setFileRiskPanelOpen}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search Loans</CardTitle>
          <CardDescription>
            Filter by loan number, borrower name, loan type, status, or risk level
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Loan number or borrower name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <SearchableSelect
            value={status || "all"}
            onChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}
            className="w-[180px]"
            options={[
              { value: "all", label: "All statuses" },
              ...PIPELINE_STAGE_SELECT_OPTIONS,
            ]}
          />
          {riskCopilotOn && (
            <>
              <SearchableSelect
                value={loanType || "all"}
                onChange={(v) => { setLoanType(v === "all" ? "" : v); setPage(1); }}
                className="w-[160px]"
                options={[
                  { value: "all", label: "All loan types" },
                  { value: "Conventional", label: "Conventional" },
                  { value: "FHA", label: "FHA" },
                  { value: "VA", label: "VA" },
                  { value: "USDA", label: "USDA" },
                  { value: "Jumbo", label: "Jumbo" },
                ]}
              />
              <SearchableSelect
                value={riskLevel || "all"}
                onChange={(v) => { setRiskLevel(v === "all" ? "" : v); setPage(1); }}
                className="w-[150px]"
                options={[
                  { value: "all", label: "All risk levels" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]}
              />
            </>
          )}
          {canExport && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting !== null}
                onClick={() => runExport("csv")}
              >
                {exporting === "csv" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting !== null}
                onClick={() => runExport("xls")}
              >
                {exporting === "xls" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Excel
              </Button>
            </div>
          )}
        </CardContent>
        {canExport && (
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Exports use current filters and include loan fields, borrower name/email, and risk level. Dates are ISO
            8601.
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="p-0">
          {view === "priority" && showPriority ? (
              <PriorityQueueView />
            ) : isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading loans...</p>
            </div>
            ) : filteredLoans.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">No loans found</p>
              {canCreate && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/loans/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add your first loan
                  </Link>
                </Button>
              )}
            </div>
            ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{riskCopilotOn ? "Copilot risk" : "Risk"}</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/loans/${loan.id}`}
                          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        >
                          {loan.loan_number}
                        </Link>
                      </TableCell>
                      <TableCell>{borrowerDisplay(loan)}</TableCell>
                      <TableCell>{loan.status}</TableCell>
                      <TableCell>
                        {riskCopilotOn ? (
                          <CopilotRiskBadge analysis={loan.latest_risk_analysis} size="sm" />
                        ) : (
                          <RiskBadge loanId={loan.id} size="sm" />
                        )}
                      </TableCell>
                      <TableCell>
                        {loan.loan_amount != null
                          ? new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 0,
                            }).format(Number(loan.loan_amount))
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDate(loan.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/loans/${loan.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open loan</TooltipContent>
                            </Tooltip>
                            {canUpdate && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link to={`/loans/${loan.id}/edit`}>
                                      <Edit className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit loan</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {view === "list" && totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * LOANS_PAGE_SIZE + 1}–{Math.min(page * LOANS_PAGE_SIZE, totalCount)} of {totalCount}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-disabled={page === 1}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {buildPageNumbers(page, totalPages).map((p, idx) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === page}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-disabled={page === totalPages}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ManagerDashboard />
    </div>
  );
}
