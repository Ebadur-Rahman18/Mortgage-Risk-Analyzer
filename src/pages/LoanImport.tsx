import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload, FileCheck } from "lucide-react";
import { downloadTextFile } from "@/lib/export-utils";
import { logActivity } from "@/lib/activity-logger";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateBorrower } from "@/hooks/useBorrowers";
import { useCreateLoan } from "@/hooks/useLoans";
import { computeDtiLtv } from "@/lib/mortgage-calculations";
import {
  riskCopilotImportSchema,
  splitBorrowerName,
  mapImportStatusToLoanStatus,
  parseRiskCopilotXml,
  type RiskCopilotImportData,
} from "@/lib/validation";

const CSV_TEMPLATE = `loan_number,external_id,data_source,borrower_id,loan_officer_id,status,loan_amount,property_address,property_city,property_state,property_postal_code
LN-EXAMPLE-001,ext-001,csv_import,PASTE-BORROWER-UUID,PASTE-OFFICER-UUID,draft,350000,123 Main St,Austin,TX,78701`;

const JSON_TEMPLATE = `{
  "borrowerName": "Jane Smith",
  "email": "jane@example.com",
  "phone": "555-0100",
  "propertyAddress": "123 Main St",
  "propertyCity": "Austin",
  "propertyState": "TX",
  "propertyPostalCode": "78701",
  "loanAmount": 350000,
  "loanType": "Conventional",
  "loanTerm": 360,
  "interestRate": 6.5,
  "annualIncome": 95000,
  "monthlyDebt": 1200,
  "creditScore": 720,
  "employmentYears": 5,
  "downPayment": 70000,
  "propertyValue": 420000,
  "status": "Pending"
}`;

export default function LoanImport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createBorrower = useCreateBorrower();
  const createLoan = useCreateLoan();

  const [csvText, setCsvText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [xmlText, setXmlText] = useState("");
  const [loading, setLoading] = useState<null | "dry" | "apply" | "copilot">(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [preview, setPreview] = useState<RiskCopilotImportData | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string | null>(null);

  function downloadTemplate() {
    downloadTextFile(CSV_TEMPLATE, "mct-loan-import-template.csv", "text/csv;charset=utf-8;");
    toast.success("Template downloaded");
  }

  function downloadJsonTemplate() {
    downloadTextFile(JSON_TEMPLATE, "mct-risk-copilot-import.json", "application/json;charset=utf-8;");
    toast.success("JSON template downloaded");
  }

  function parseCopilotImport(raw: unknown): RiskCopilotImportData {
    const result = riskCopilotImportSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(result.error.errors.map((e) => e.message).join("; "));
    }
    return result.data;
  }

  function validateCopilotText(format: "json" | "xml") {
    setPreview(null);
    setPreviewErrors(null);
    try {
      let raw: unknown;
      if (format === "json") {
        raw = JSON.parse(jsonText);
      } else {
        raw = parseRiskCopilotXml(xmlText);
      }
      const data = parseCopilotImport(raw);
      setPreview(data);
      toast.success("Validation passed — review preview below.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid import data";
      setPreviewErrors(msg);
      toast.error(msg);
    }
  }

  async function applyCopilotImport() {
    if (!preview || !user?.id) return;
    setLoading("copilot");
    try {
      const { first_name, last_name } = splitBorrowerName(preview.borrowerName);
      const borrower = await createBorrower.mutateAsync({
        input: {
          first_name,
          last_name,
          email: preview.email || null,
          phone: preview.phone || null,
          data_source: "risk_copilot_import",
        },
        createdByUserId: user.id,
      });

      const { dti, ltv } = computeDtiLtv({
        annualIncome: preview.annualIncome ?? null,
        monthlyDebt: preview.monthlyDebt ?? null,
        loanAmount: preview.loanAmount,
        propertyValue: preview.propertyValue ?? null,
      });

      const loan = await createLoan.mutateAsync({
        borrower_id: borrower.id,
        loan_officer_id: user.id,
        status: mapImportStatusToLoanStatus(preview.status),
        loan_amount: preview.loanAmount,
        appraised_value: preview.propertyValue ?? null,
        loan_type: preview.loanType || null,
        loan_term_months: preview.loanTerm ?? null,
        interest_rate: preview.interestRate ?? null,
        annual_income: preview.annualIncome ?? null,
        monthly_debt: preview.monthlyDebt ?? null,
        credit_score: preview.creditScore ?? null,
        employment_years: preview.employmentYears ?? null,
        down_payment: preview.downPayment ?? null,
        dti,
        ltv,
        property_address: preview.propertyAddress,
        property_city: preview.propertyCity || null,
        property_state: preview.propertyState || null,
        property_postal_code: preview.propertyPostalCode || null,
        data_source: "risk_copilot_import",
      });

      logActivity({
        action: "create",
        resourceType: "loan",
        resourceId: loan.id,
        details: { operation: "risk_copilot_json_import" },
      });
      toast.success("Loan imported successfully");
      navigate(`/loans/${loan.id}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(null);
    }
  }

  async function runImport(dryRun: boolean) {
    if (!csvText.trim()) {
      toast.error("Paste CSV content first.");
      return;
    }
    setLoading(dryRun ? "dry" : "apply");
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-loans-csv", {
        body: { csv_text: csvText, dry_run: dryRun },
      });
      if (error) throw error;
      const body = data as {
        error?: string;
        errors?: { line: number; message: string }[];
        valid_rows?: number;
        message?: string;
        imported?: number;
        updated?: number;
        failed?: number;
      };
      if (body?.error) throw new Error(body.error);

      if (body.errors && body.errors.length > 0) {
        const msg = body.errors.map((e) => `Line ${e.line}: ${e.message}`).join("\n");
        setLastResult(msg);
        toast.error("Validation issues — see details below.");
        return;
      }

      if (dryRun) {
        setLastResult(body.message ?? `OK — ${body.valid_rows ?? 0} row(s) valid.`);
        logActivity({
          action: "view",
          resourceType: "loan",
          details: { operation: "import_dry_run", valid_rows: body.valid_rows ?? 0 },
        });
        toast.success("Dry run passed. You can apply the import.");
      } else {
        setLastResult(
          `Imported ${body.imported ?? 0}, updated ${body.updated ?? 0}, failed ${body.failed ?? 0}.`,
        );
        logActivity({
          action: "create",
          resourceType: "loan",
          details: {
            operation: "import_apply",
            imported: body.imported ?? 0,
            updated: body.updated ?? 0,
            failed: body.failed ?? 0,
          },
        });
        toast.success("Import finished.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import loans</h1>
        <p className="text-sm text-muted-foreground">
          CSV bulk import or Risk Copilot JSON/XML single-application import with Zod validation.
        </p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList>
          <TabsTrigger value="csv">CSV</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="xml">XML</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4 mt-4">
          <Alert>
            <AlertDescription>
              Borrower and loan officer IDs must already exist. Prefer LOS sync for ongoing data.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>CSV bulk import</CardTitle>
              <CardDescription>
                Upsert by data_source + external_id. Run a dry run before applying.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                Download template
              </Button>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV here..."
                className="min-h-[220px] font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => runImport(true)}
                >
                  {loading === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                  Dry run
                </Button>
                <Button type="button" disabled={loading !== null} onClick={() => runImport(false)}>
                  {loading === "apply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Apply import
                </Button>
              </div>
              {lastResult && (
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                  {lastResult}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>JSON import (Risk Copilot)</CardTitle>
              <CardDescription>
                Paste or upload a single mortgage application JSON object. Invalid data will not be saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button type="button" variant="outline" size="sm" onClick={downloadJsonTemplate}>
                Download JSON template
              </Button>
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder="Paste JSON here..."
                className="min-h-[220px] font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => validateCopilotText("json")}>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Validate
                </Button>
                <Button
                  type="button"
                  disabled={!preview || loading !== null}
                  onClick={() => void applyCopilotImport()}
                >
                  {loading === "copilot" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Create borrower &amp; loan
                </Button>
              </div>
              {previewErrors && (
                <p className="text-sm text-destructive">{previewErrors}</p>
              )}
              {preview && (
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="xml" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>XML import (Risk Copilot)</CardTitle>
              <CardDescription>
                Root element with child tags matching JSON field names (e.g. borrowerName, loanAmount).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={xmlText}
                onChange={(e) => setXmlText(e.target.value)}
                placeholder={'<MortgageApplication>\n  <borrowerName>Jane Smith</borrowerName>\n  ...\n</MortgageApplication>'}
                className="min-h-[220px] font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => validateCopilotText("xml")}>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Validate
                </Button>
                <Button
                  type="button"
                  disabled={!preview || loading !== null}
                  onClick={() => void applyCopilotImport()}
                >
                  {loading === "copilot" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Create borrower &amp; loan
                </Button>
              </div>
              {previewErrors && (
                <p className="text-sm text-destructive">{previewErrors}</p>
              )}
              {preview && (
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
