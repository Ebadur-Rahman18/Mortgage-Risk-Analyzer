import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cpu } from "lucide-react";
import { useAusSubmissions, useSubmitAusRequest } from "@/hooks/usePhase3LoanTools";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { permissionKey } from "@/lib/permissions";

interface Props {
  loanId: string;
}

export function LoanAusCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const canSubmit =
    hasPermission(permissionKey("aus", "submit")) || hasPermission("loans:update");
  const { data: subs = [], isLoading } = useAusSubmissions(loanId);
  const submit = useSubmitAusRequest(loanId);

  const latest = subs[0] as
    | {
        provider?: string;
        status?: string;
        response_payload?: { message?: string; stub?: boolean };
        created_at?: string;
      }
    | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          AUS (DU / LP)
        </CardTitle>
        <CardDescription>
          Desktop Underwriter / Loan Product Advisor — enable integrations under Admin → Data Feeds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canSubmit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={submit.isPending}
              onClick={() => void submit.mutateAsync("du")}
            >
              {submit.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Submit DU
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={submit.isPending}
              onClick={() => void submit.mutateAsync("lp")}
            >
              Submit LPA
            </Button>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : latest ? (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{latest.provider?.toUpperCase()}</Badge>
              <span className="text-muted-foreground text-xs">{latest.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {(latest.response_payload as { message?: string })?.message ?? "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {latest.created_at ? new Date(latest.created_at).toLocaleString() : ""}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No AUS submissions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
