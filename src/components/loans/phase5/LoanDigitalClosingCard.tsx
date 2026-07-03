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
  useLoanDigitalClosing,
  useDigitalClosingMutations,
  type DigitalEcloseStatus,
  type DigitalEnoteStatus,
} from "@/hooks/useClosingExecution";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { permissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { MonitorSmartphone, Loader2 } from "lucide-react";

const ECLOSE: DigitalEcloseStatus[] = ["not_started", "draft", "sent", "borrower_signed", "completed", "n_a"];
const ENOTE: DigitalEnoteStatus[] = ["not_started", "pending", "registered", "n_a", "wet_note"];

interface Props {
  loanId: string;
}

export function LoanDigitalClosingCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: row, isLoading } = useLoanDigitalClosing(loanId);
  const { ensureAndUpdate } = useDigitalClosingMutations(loanId);

  if (!canView) return null;

  const save = async (patch: Parameters<typeof ensureAndUpdate.mutateAsync>[0]) => {
    try {
      await ensureAndUpdate.mutateAsync(patch);
      toast.success("Saved closing checklist.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const start = async () => {
    await save({});
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorSmartphone className="h-4 w-4" />
          eClose / eNote checklist
        </CardTitle>
        <CardDescription>
          Manual milestones for hybrid or digital closes. This is not a full eClosing platform; DocuSign disclosures stay on
          their own card. eClose platform stub is in Integrations for future wiring.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !row ? (
          canMutate ? (
            <Button type="button" size="sm" onClick={() => void start()} disabled={ensureAndUpdate.isPending}>
              Start tracking for this loan
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">No digital closing record yet.</p>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="space-y-1">
              <Label className="text-xs">eClose package</Label>
              <Select
                value={row.eclose_package_status}
                disabled={!canMutate}
                onValueChange={(v) => void save({ eclose_package_status: v as DigitalEcloseStatus })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ECLOSE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">eNote</Label>
              <Select
                value={row.enote_status}
                disabled={!canMutate}
                onValueChange={(v) => void save({ enote_status: v as DigitalEnoteStatus })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENOTE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor / platform</Label>
              <Input
                className="h-9"
                defaultValue={row.vendor_name ?? ""}
                disabled={!canMutate}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (row.vendor_name ?? "")) void save({ vendor_name: v || null });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closing scheduled</Label>
              <Input
                type="date"
                className="h-9"
                defaultValue={row.closing_scheduled_date?.slice(0, 10) ?? ""}
                disabled={!canMutate}
                onBlur={(e) => {
                  const d = e.target.value;
                  void save({ closing_scheduled_date: d ? d : null });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Package sent at</Label>
              <Input
                type="datetime-local"
                className="h-9"
                defaultValue={isoToLocal(row.package_sent_at)}
                disabled={!canMutate}
                onBlur={(e) => void save({ package_sent_at: localToIso(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closing completed at</Label>
              <Input
                type="datetime-local"
                className="h-9"
                defaultValue={isoToLocal(row.closing_completed_at)}
                disabled={!canMutate}
                onBlur={(e) => void save({ closing_completed_at: localToIso(e.target.value) })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={3}
                defaultValue={row.notes ?? ""}
                disabled={!canMutate}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v !== (row.notes ?? "")) void save({ notes: v || null });
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
