import { FileSignature, ExternalLink, Check, Clock, X, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalDisclosure } from "@/lib/borrowerPortalApi";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  sent: { label: "Awaiting Signature", variant: "default", icon: Clock },
  viewed: { label: "Viewed", variant: "outline", icon: Eye },
  signed: { label: "Signed", variant: "default", icon: Check },
  declined: { label: "Declined", variant: "destructive", icon: X },
};

interface Props {
  disclosures: PortalDisclosure[];
}

export function PortalDisclosuresCard({ disclosures }: Props) {
  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Disclosures
        </CardTitle>
      </CardHeader>
      <CardContent>
        {disclosures.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No disclosures to sign at this time.
          </p>
        ) : (
          <div className="space-y-3">
            {disclosures.map((d) => {
              const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              const needsAction = d.status === "sent" || d.status === "viewed";
              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border",
                    needsAction && "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30",
                    d.status === "signed" && "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant={cfg.variant} className="text-[10px] gap-1 h-5">
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                      {d.sent_at && <span>Sent {formatDate(d.sent_at)}</span>}
                      {d.signed_at && <span>Signed {formatDate(d.signed_at)}</span>}
                    </div>
                  </div>

                  {needsAction && d.signing_url && (
                    <Button
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => window.open(d.signing_url!, "_blank")}
                    >
                      Sign Now
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
