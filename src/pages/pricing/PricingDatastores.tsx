import { useState } from "react";
import { useRateSheets, useRateSheetDatastores } from "@/hooks/usePricing";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Globe, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseRateSheetXlsxToRows } from "@/lib/parseRateSheetXlsx";
import { Label } from "@/components/ui/label";

type DatastoreSection = "manual" | "external";

// External integration sources — add new entries here to surface additional providers.
const EXTERNAL_SOURCES = [
  {
    id: "fannie_mae",
    name: "Fannie Mae",
    description: "Desktop Underwriter pricing via direct API feed.",
    logo: "FM",
    color: "bg-blue-600",
  },
  {
    id: "freddie_mac",
    name: "Freddie Mac",
    description: "Loan Product Advisor integrated pricing data.",
    logo: "FH",
    color: "bg-red-600",
  },
  {
    id: "loanpro",
    name: "LoanPro",
    description: "Sync rate tables directly from LoanPro CRM.",
    logo: "LP",
    color: "bg-indigo-600",
  },
  {
    id: "lendingpad",
    name: "LendingPad",
    description: "Pull current rate sheets from LendingPad LOS.",
    logo: "LP",
    color: "bg-emerald-600",
  },
];

export default function PricingDatastores() {
  const [activeSection, setActiveSection] = useState<DatastoreSection>("manual");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Datastore</h1>
        <p className="text-sm text-muted-foreground">
          Manage rate sheet uploads and external pricing integrations.
        </p>
      </div>

      {/* Internal section tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveSection("manual")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2",
            activeSection === "manual"
              ? "border-primary text-foreground bg-muted/50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <Upload className="h-4 w-4" />
          Manual Upload
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("external")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2",
            activeSection === "external"
              ? "border-primary text-foreground bg-muted/50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <Globe className="h-4 w-4" />
          External Sources
        </button>
      </div>

      {activeSection === "manual" && <ManualUploadSection />}
      {activeSection === "external" && <ExternalSourcesSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Manual Upload
// ---------------------------------------------------------------------------
function ManualUploadSection() {
  const { data: rateSheets, isLoading, refetch } = useRateSheets();
  const [csvText, setCsvText] = useState("");
  const [name, setName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [investorCode, setInvestorCode] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (rows?: Array<Record<string, string>>) => {
    if (!name) {
      toast.error("Rate sheet name is required");
      return;
    }
    if (!rows && !csvText) {
      toast.error("Paste CSV or upload an Excel file");
      return;
    }
    setUploading(true);
    try {
      const body: Record<string, unknown> = {
        name,
        effective_date: effectiveDate || null,
        expiration_date: expirationDate || null,
        investor_code: investorCode.trim() || null,
      };
      if (rows && rows.length) body.rows = rows;
      else body.csv_text = csvText;

      const { data, error } = await supabase.functions.invoke<{ products_inserted?: number }>(
        "pricing-rate-sheets-upload",
        { body },
      );
      if (error) throw error;
      toast.success(`Uploaded rate sheet with ${data?.products_inserted ?? 0} rows`);
      setName("");
      setCsvText("");
      setEffectiveDate("");
      setExpirationDate("");
      setInvestorCode("");
      refetch();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to upload rate sheet");
    } finally {
      setUploading(false);
    }
  };

  const onExcelFile = async (file: File | null) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const rows = parseRateSheetXlsxToRows(buf);
      if (!rows.length) {
        toast.error("No rows in spreadsheet");
        return;
      }
      await handleUpload(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to read Excel file");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload rate sheet (CSV or Excel)</CardTitle>
          <CardDescription>
            Columns: Product, Loan Type, Rate, Price, Min FICO, Max LTV, State — optional: Min Loan, Max Loan,
            Occupancy Filter, Purpose Filter, Property Filter, Adjustments (JSON array).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Rate sheet name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Effective date</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Expiration date</Label>
              <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
            </div>
          </div>
          <Input
            placeholder="Investor code (optional)"
            value={investorCode}
            onChange={(e) => setInvestorCode(e.target.value)}
          />
          <div>
            <Label className="text-xs">Excel (.xlsx)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              className="cursor-pointer"
              onChange={(e) => void onExcelFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <textarea
            className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Or paste CSV content here"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Button onClick={() => void handleUpload()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Rate Sheets</CardTitle>
          <CardDescription>Latest uploaded and imported rate sheets.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !rateSheets || rateSheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rate sheets found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Effective</th>
                    <th className="px-3 py-2">Expiration</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rateSheets.map((sheet) => (
                    <tr key={sheet.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{sheet.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {sheet.effective_date || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {sheet.expiration_date || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {sheet.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {sheet.source_type === "datastore" ? "Datastore" : "Upload"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: External Sources
// ---------------------------------------------------------------------------
function ExternalSourcesSection() {
  const { data: datastores, isLoading, refetch } = useRateSheetDatastores();
  const [providerName, setProviderName] = useState("");
  const [connectionType, setConnectionType] = useState<"csv_import" | "external_tool">("csv_import");
  const [csvText, setCsvText] = useState("");
  const [selectedDatastore, setSelectedDatastore] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!providerName) {
      toast.error("Provider name is required");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ datastore?: { provider_name?: string } }>(
        "pricing-datastores",
        {
          body: {
            action: "create",
            provider_name: providerName,
            connection_type: connectionType,
          },
        },
      );
      if (error) throw error;
      toast.success(`Created datastore ${data?.datastore?.provider_name ?? ""}`);
      setProviderName("");
      refetch();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create datastore");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!selectedDatastore || !csvText) {
      toast.error("Select a datastore and provide CSV text");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        products_inserted?: number;
        rate_sheet?: { name?: string };
      }>("pricing-datastores", {
        body: {
          action: "import",
          datastore_id: selectedDatastore,
          csv_text: csvText,
        },
      });
      if (error) throw error;
      toast.success(
        `Imported ${data?.products_inserted ?? 0} rows into new rate sheet "${data?.rate_sheet?.name ?? ""}"`,
      );
      setCsvText("");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to import pricing data");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Integration placeholders */}
      <div>
        <h2 className="text-base font-semibold mb-1">Integrations</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect to external pricing sources. More integrations coming soon.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXTERNAL_SOURCES.map((src) => (
            <Card key={src.id} className="relative overflow-hidden">
              <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white",
                      src.color
                    )}
                  >
                    {src.logo}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{src.name}</p>
                    <Badge variant="secondary" className="mt-0.5 text-[10px] px-1.5 py-0">
                      Coming Soon
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {src.description}
                </p>
                <Button variant="outline" size="sm" disabled className="w-full mt-auto">
                  Connect
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom datastore connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Custom Datastore
          </CardTitle>
          <CardDescription>Register a custom pricing datastore connection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Provider name (e.g. Fannie Mae Desktop Underwriter)"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
          />
          <div className="flex gap-3 text-sm">
            <Button
              type="button"
              variant={connectionType === "csv_import" ? "default" : "outline"}
              size="sm"
              onClick={() => setConnectionType("csv_import")}
            >
              CSV Import
            </Button>
            <Button
              type="button"
              variant={connectionType === "external_tool" ? "default" : "outline"}
              size="sm"
              onClick={() => setConnectionType("external_tool")}
            >
              External Tool
            </Button>
          </div>
          <Button onClick={handleCreate} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Datastore
          </Button>
        </CardContent>
      </Card>

      {/* Existing datastores + import */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Datastores</CardTitle>
          <CardDescription>Select a datastore to import pricing data into it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !datastores || datastores.length === 0 ? (
            <p className="text-sm text-muted-foreground">No datastores configured yet.</p>
          ) : (
            <div className="space-y-2">
              {datastores.map((ds) => (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => setSelectedDatastore(ds.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selectedDatastore === ds.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="font-medium">{ds.provider_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ds.connection_type} · {ds.status}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <textarea
              className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Paste CSV text to import into the selected datastore"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <Button onClick={handleImport} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import Pricing Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
