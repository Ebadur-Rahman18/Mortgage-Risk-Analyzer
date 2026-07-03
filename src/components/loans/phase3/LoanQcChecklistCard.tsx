import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck } from "lucide-react";
import {
  useActiveQcTemplate,
  useLoanQcResults,
  useUpsertLoanQcResult,
} from "@/hooks/usePhase3LoanTools";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  loanId: string;
  canEdit: boolean;
}

export function LoanQcChecklistCard({ loanId, canEdit }: Props) {
  const { user } = useAuth();
  const { data: template, isLoading: tLoading } = useActiveQcTemplate();
  const { data: results = [], isLoading: rLoading } = useLoanQcResults(loanId);
  const upsert = useUpsertLoanQcResult(loanId, template?.id ?? null);

  const byKey = new Map(results.map((r: { item_key: string; status: string }) => [r.item_key, r.status]));

  const signOff = async () => {
    const { error } = await supabase
      .from("loan_qc_results")
      .update({
        signed_off_by: user?.id ?? null,
        signed_off_at: new Date().toISOString(),
      })
      .eq("loan_id", loanId);
    if (error) toast.error(error.message);
    else toast.success("QC sign-off recorded");
  };

  if (tLoading || !template) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Pre-close QC
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <p className="text-sm text-muted-foreground">No active QC template.</p>}
        </CardContent>
      </Card>
    );
  }

  const items = template.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Pre-close QC — {template.name}
        </CardTitle>
        <CardDescription>Checklist status for this loan file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {items.map((item) => {
          const st = (byKey.get(item.id) as string | undefined) ?? "";
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-2 justify-between rounded border px-2 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span>{item.label}</span>
                {item.required && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Required
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                {(["pass", "fail", "na"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={st === s ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs capitalize"
                    disabled={!canEdit || upsert.isPending}
                    onClick={() => upsert.mutate({ item_key: item.id, status: s })}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
        {canEdit && items.length > 0 && (
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => void signOff()}>
            Sign off QC review
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
