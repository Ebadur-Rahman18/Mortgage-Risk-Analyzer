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
import { useRonSessions, useRonSessionMutations, type RonSessionStatus } from "@/hooks/useClosingExecution";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { permissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { Video, Loader2 } from "lucide-react";

const STATUSES: RonSessionStatus[] = ["not_scheduled", "scheduled", "in_session", "completed", "cancelled", "failed"];

interface Props {
  loanId: string;
}

export function LoanRonCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: rows = [], isLoading } = useRonSessions(loanId);
  const { insertOne, updateRow, removeRow } = useRonSessionMutations(loanId);

  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");

  if (!canView) return null;

  const add = async () => {
    try {
      await insertOne.mutateAsync({ vendor_name: vendor.trim() || null, notes: notes.trim() || null });
      toast.success("RON session added.");
      setVendor("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" />
          RON
        </CardTitle>
        <CardDescription>Remote online notarization sessions (manual). RON provider stub lives in Integrations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canMutate ? (
          <div className="space-y-2 border-b pb-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Input className="h-9" value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </div>
              <Button className="h-9 self-end" type="button" onClick={() => void add()} disabled={insertOne.isPending}>
                Add session
              </Button>
            </div>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          </div>
        ) : null}

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex justify-between gap-2 flex-wrap">
                  <Select
                    value={r.status}
                    disabled={!canMutate}
                    onValueChange={(v) =>
                      void updateRow
                        .mutateAsync({ id: r.id, status: v as RonSessionStatus })
                        .then(() => toast.success("Updated"))
                        .catch((e) => toast.error(String(e)))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canMutate ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => void removeRow.mutateAsync(r.id).then(() => toast.success("Removed")).catch((e) => toast.error(String(e)))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Vendor</Label>
                    <Input
                      className="h-8 text-xs"
                      defaultValue={r.vendor_name ?? ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.vendor_name ?? "")) void updateRow.mutateAsync({ id: r.id, vendor_name: v || null });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Session ref</Label>
                    <Input
                      className="h-8 text-xs"
                      defaultValue={r.provider_session_ref ?? ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.provider_session_ref ?? ""))
                          void updateRow.mutateAsync({ id: r.id, provider_session_ref: v || null });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Scheduled</Label>
                    <Input
                      type="datetime-local"
                      className="h-8 text-xs"
                      defaultValue={isoToLocal(r.scheduled_at)}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const v = localToIso(e.target.value);
                        void updateRow.mutateAsync({ id: r.id, scheduled_at: v });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Completed</Label>
                    <Input
                      type="datetime-local"
                      className="h-8 text-xs"
                      defaultValue={isoToLocal(r.completed_at)}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const v = localToIso(e.target.value);
                        void updateRow.mutateAsync({ id: r.id, completed_at: v });
                      }}
                    />
                  </div>
                </div>
                {r.notes ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p> : null}
              </li>
            ))}
            {rows.length === 0 ? <p className="text-xs text-muted-foreground">No RON sessions.</p> : null}
          </ul>
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
