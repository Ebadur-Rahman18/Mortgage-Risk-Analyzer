import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface LoanProduct {
  id: string;
  product_name: string;
  product_type: string;
  term_months: number;
  rate_type: string;
  is_active: boolean;
}

interface LoanProgram {
  id: string;
  product_id: string;
  program_code: string;
  program_name: string;
  min_credit_score: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  occupancy_type: string | null;
  loan_limit: number | null;
  guidelines: Record<string, unknown> | null;
  is_active: boolean;
}

function GuidelinesPreview({ guidelines }: { guidelines: Record<string, unknown> }) {
  const propertyTypes = guidelines.property_types;
  const occupancyTypes = guidelines.occupancy_types;
  const matrix = guidelines.fico_ltv_matrix;
  const propertyList = Array.isArray(propertyTypes) ? propertyTypes.map(String) : null;
  const occupancyList = Array.isArray(occupancyTypes) ? occupancyTypes.map(String) : null;
  const tiers = Array.isArray(matrix)
    ? matrix.filter(
        (t): t is { min_fico: number; max_ltv: number } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as { min_fico?: unknown }).min_fico === "number" &&
          typeof (t as { max_ltv?: unknown }).max_ltv === "number",
      )
    : null;

  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Guidelines:</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {propertyList && propertyList.length > 0 && (
          <div>
            <span className="text-muted-foreground">Property types:</span> {propertyList.join(", ")}
          </div>
        )}
        {occupancyList && occupancyList.length > 0 && (
          <div>
            <span className="text-muted-foreground">Occupancy:</span> {occupancyList.join(", ")}
          </div>
        )}
        {tiers && tiers.length > 0 && (
          <div className="col-span-2">
            <span className="text-muted-foreground">FICO/LTV Matrix:</span>
            <div className="mt-1 flex gap-2 flex-wrap">
              {tiers.map((tier, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  FICO {tier.min_fico}+ / LTV {tier.max_ltv}%
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoanProgramsAdmin() {
  const qc = useQueryClient();
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");
  const [importDryRun, setImportDryRun] = useState(true);

  const importGuidelines = useMutation({
    mutationFn: async (payload: { dry_run: boolean; updates: Array<{ program_id: string; guidelines: Record<string, unknown> }> }) => {
      const { data, error } = await supabase.functions.invoke("import-loan-program-guidelines", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { results: Array<{ program_id: string; ok: boolean; error?: string }> };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin_loan_programs"] });
      const bad = data.results?.filter((r) => !r.ok).length ?? 0;
      toast.success(bad ? `Import finished with ${bad} error(s)` : "Guidelines imported");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ["admin_loan_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_products").select("*").order("product_name");
      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  const { data: programs = [], isLoading: progLoading } = useQuery({
    queryKey: ["admin_loan_programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_programs").select("*").order("program_name");
      if (error) throw error;
      return data as LoanProgram[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ table, id, is_active }: { table: string; id: string; is_active: boolean }) => {
      const { error } = await supabase.from(table).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_loan_products"] });
      qc.invalidateQueries({ queryKey: ["admin_loan_programs"] });
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const isLoading = prodLoading || progLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Programs</h1>
          <p className="text-muted-foreground">Manage products, programs, and eligibility guidelines</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk import program guidelines</CardTitle>
          <CardDescription>
            Paste a JSON array:{" "}
            <code className="text-xs">
              [&#123; &quot;program_id&quot;: &quot;uuid&quot;, &quot;guidelines&quot;: &#123; ... &#125; &#125;, ...]
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="font-mono text-xs min-h-[120px]"
            placeholder='[{"program_id":"…","guidelines":{"fico_ltv_matrix":[{"min_fico":620,"max_ltv":95}]}}]'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Checkbox id="dryg" checked={importDryRun} onCheckedChange={(c) => setImportDryRun(!!c)} />
            <Label htmlFor="dryg" className="text-sm font-normal">
              Dry run (validate only)
            </Label>
          </div>
          <Button
            type="button"
            disabled={importGuidelines.isPending}
            onClick={() => {
              try {
                const parsed = JSON.parse(importJson) as Array<{ program_id: string; guidelines: Record<string, unknown> }>;
                if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
                importGuidelines.mutate({ dry_run: importDryRun, updates: parsed });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Invalid JSON");
              }
            }}
          >
            {importGuidelines.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply import
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const productPrograms = programs.filter((p) => p.product_id === product.id);
            const isExpanded = expandedProduct === product.id;

            return (
              <Card key={product.id}>
                <CardHeader
                  className="cursor-pointer flex flex-row items-center justify-between"
                  onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div>
                      <CardTitle className="text-base">{product.product_name}</CardTitle>
                      <CardDescription>
                        {product.product_type} · {product.term_months / 12}yr · {product.rate_type}
                        · {productPrograms.length} program{productPrograms.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={product.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ table: "loan_products", id: product.id, is_active: v })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent>
                    {productPrograms.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No programs for this product.</p>
                    ) : (
                      <div className="space-y-3">
                        {productPrograms.map((prog) => (
                          <div key={prog.id} className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{prog.program_name}</p>
                                <p className="text-xs text-muted-foreground">Code: {prog.program_code}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={prog.is_active ? "default" : "secondary"}>
                                  {prog.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Switch
                                  checked={prog.is_active}
                                  onCheckedChange={(v) => toggleActive.mutate({ table: "loan_programs", id: prog.id, is_active: v })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Min FICO:</span>{" "}
                                <span className="font-medium">{prog.min_credit_score ?? "—"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Max LTV:</span>{" "}
                                <span className="font-medium">{prog.max_ltv ? `${prog.max_ltv}%` : "—"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Max DTI:</span>{" "}
                                <span className="font-medium">{prog.max_dti ? `${prog.max_dti}%` : "—"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Loan Limit:</span>{" "}
                                <span className="font-medium">
                                  {prog.loan_limit
                                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(prog.loan_limit))
                                    : "—"}
                                </span>
                              </div>
                            </div>
                            {prog.guidelines && Object.keys(prog.guidelines).length > 0 && (
                              <GuidelinesPreview guidelines={prog.guidelines} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
