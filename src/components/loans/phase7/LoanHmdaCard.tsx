// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHmdaByLoan, useHmdaMutations } from "@/hooks/usePhase7Compliance";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

interface Props {
  loanId: string;
}

const ACTIONS = [
  "originated",
  "approved_not_accepted",
  "denied",
  "withdrawn",
  "closed_incomplete",
  "purchased",
  "preapproval_denied",
  "preapproval_approved_not_accepted",
] as const;

const PURPOSES = ["home_purchase", "home_improvement", "refinancing", "cash_out_refi", "other"] as const;

const LOAN_TYPES = ["conventional", "fha", "va", "usda_rhs", "other"] as const;

export function LoanHmdaCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: row, isLoading } = useHmdaByLoan(loanId);
  const { upsert } = useHmdaMutations(loanId);
  const [reasonLines, setReasonLines] = useState("");

  const reasonsJoined = useMemo(() => {
    if (!row?.denial_reasons || !Array.isArray(row.denial_reasons)) return "";
    return row.denial_reasons.filter((x: unknown) => typeof x === "string").join("\n");
  }, [row?.denial_reasons]);

  if (!canView) return null;

  const save = async (patch: Record<string, unknown>) => {
    try {
      await upsert.mutateAsync(patch);
      toast.success("HMDA saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" />
          HMDA LAR tracking
        </CardTitle>
        <CardDescription>
          Manual HMDA reporting fields captured on the loan for annual LAR export and QA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="space-y-1">
              <Label className="text-xs">Filing year</Label>
              <Input
                type="number"
                className="h-9"
                defaultValue={row?.filing_year ?? new Date().getFullYear()}
                disabled={!canMutate}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isNaN(n)) void save({ filing_year: n });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action taken</Label>
              <Select
                value={row?.action_taken ?? "none"}
                disabled={!canMutate}
                onValueChange={(v) => void save({ action_taken: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ACTIONS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action date</Label>
              <Input
                type="date"
                className="h-9"
                defaultValue={row?.action_taken_date?.slice(0, 10) ?? ""}
                disabled={!canMutate}
                onBlur={(e) => void save({ action_taken_date: e.target.value || null })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Loan purpose</Label>
              <Select
                value={row?.loan_purpose ?? "none"}
                disabled={!canMutate}
                onValueChange={(v) => void save({ loan_purpose: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PURPOSES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Loan type</Label>
              <Select
                value={row?.loan_type ?? "none"}
                disabled={!canMutate}
                onValueChange={(v) => void save({ loan_type: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {LOAN_TYPES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rate spread</Label>
              <Input
                type="number"
                className="h-9"
                defaultValue={row?.rate_spread ?? ""}
                disabled={!canMutate}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const n = raw === "" ? null : Number(raw);
                  if (n === null || !Number.isNaN(n)) void save({ rate_spread: n });
                }}
              />
            </div>
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <Label className="text-xs">Denial reasons (one per line)</Label>
              <Textarea
                rows={3}
                defaultValue={reasonsJoined}
                disabled={!canMutate}
                onChange={(e) => setReasonLines(e.target.value)}
              />
              {canMutate && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void save({
                      denial_reasons: (reasonLines || reasonsJoined)
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                >
                  Save denial reasons
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
