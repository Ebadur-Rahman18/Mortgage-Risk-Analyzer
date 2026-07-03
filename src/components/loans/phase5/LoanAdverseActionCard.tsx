import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdverseActions,
  useAdverseActionMutations,
  type AdverseActionStatus,
  type AdverseDecision,
} from "@/hooks/useClosingExecution";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { permissionKey } from "@/lib/permissions";
import { buildAdverseActionNoticeDraft } from "@/lib/adverseActionLetter";
import { toast } from "sonner";
import { MailWarning, Loader2, Copy } from "lucide-react";

const STATUSES: AdverseActionStatus[] = ["draft", "generated", "mailed", "delivered", "cancelled"];
const DECISIONS: (AdverseDecision | "")[] = ["", "denied", "withdrawn", "counteroffer_declined", "other"];

function parseReasonCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

interface Props {
  loanId: string;
  loanNumber: string;
  applicantLabel: string;
}

export function LoanAdverseActionCard({ loanId, loanNumber, applicantLabel }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: rows = [], isLoading } = useAdverseActions(loanId);
  const { insertOne, updateRow, removeRow } = useAdverseActionMutations(loanId);

  const [institution, setInstitution] = useState("");
  const [reasonLines, setReasonLines] = useState("");
  const [narrative, setNarrative] = useState("");
  const [decision, setDecision] = useState<AdverseDecision | "">("");

  if (!canView) return null;

  const addDraft = async () => {
    const reasons = reasonLines
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await insertOne.mutateAsync({
        status: "draft",
        decision: decision || null,
        reason_codes: reasons,
        narrative: narrative.trim() || null,
      });
      toast.success("Adverse action record created.");
      setReasonLines("");
      setNarrative("");
      setDecision("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const buildDraftForRow = (
    r: {
      decision: string | null;
      reason_codes: unknown;
      narrative: string | null;
    },
  ) => {
    const d = (r.decision as AdverseDecision | null) ?? undefined;
    return buildAdverseActionNoticeDraft({
      institutionName: institution.trim() || "Your organization",
      loanNumber,
      applicantLabel,
      decision: d,
      reasonCodes: parseReasonCodes(r.reason_codes),
      narrative: r.narrative,
      ecraNotice: true,
    });
  };

  const copyDraft = async (r: (typeof rows)[0]) => {
    const text = buildDraftForRow(r);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied to clipboard.");
    } catch {
      toast.error("Clipboard not available.");
    }
  };

  const markGenerated = async (r: (typeof rows)[0]) => {
    try {
      await updateRow.mutateAsync({
        id: r.id,
        status: "generated",
        generated_at: new Date().toISOString(),
      });
      toast.success("Marked as generated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MailWarning className="h-4 w-4" />
          Adverse action
        </CardTitle>
        <CardDescription>
          Track notices and generate a plain-text draft (not legal advice). Mailing vendor hook is optional in Integrations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canMutate ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Institution name (for letter draft only)</Label>
                <Input className="h-9" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Lender legal name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Decision</Label>
                <Select value={decision || "none"} onValueChange={(v) => setDecision(v === "none" ? "" : (v as AdverseDecision))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {DECISIONS.filter((x) => x !== "").map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason lines (one per line)</Label>
              <Textarea rows={3} value={reasonLines} onChange={(e) => setReasonLines(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Narrative</Label>
              <Textarea rows={2} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={() => void addDraft()} disabled={insertOne.isPending}>
              Add record
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <Select
                    value={r.status}
                    disabled={!canMutate}
                    onValueChange={(v) =>
                      void updateRow
                        .mutateAsync({ id: r.id, status: v as AdverseActionStatus })
                        .then(() => toast.success("Updated"))
                        .catch((e) => toast.error(String(e)))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => void copyDraft(r)}>
                      <Copy className="h-3.5 w-3.5" />
                      Copy draft
                    </Button>
                    {canMutate ? (
                      <>
                        <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => void markGenerated(r)}>
                          Mark generated
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive"
                          onClick={() =>
                            void removeRow.mutateAsync(r.id).then(() => toast.success("Removed")).catch((e) => toast.error(String(e)))
                          }
                        >
                          Remove
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {r.generated_at ? (
                  <p className="text-xs text-muted-foreground">Generated: {new Date(r.generated_at).toLocaleString()}</p>
                ) : null}
                {r.mailed_at ? <p className="text-xs text-muted-foreground">Mailed: {new Date(r.mailed_at).toLocaleString()}</p> : null}
                {parseReasonCodes(r.reason_codes).length ? (
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {parseReasonCodes(r.reason_codes).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : null}
                {r.narrative ? <p className="text-xs whitespace-pre-wrap">{r.narrative}</p> : null}
              </li>
            ))}
            {rows.length === 0 ? <p className="text-xs text-muted-foreground">No adverse action records.</p> : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
