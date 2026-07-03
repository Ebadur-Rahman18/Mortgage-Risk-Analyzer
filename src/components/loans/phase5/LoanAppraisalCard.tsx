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
import { useAppraisalOrders, useAppraisalOrderMutations, type AppraisalOrderStatus } from "@/hooks/useClosingExecution";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { permissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";

const STATUSES: AppraisalOrderStatus[] = [
  "not_ordered",
  "ordered",
  "inspection_scheduled",
  "report_received",
  "under_review",
  "accepted",
  "revisions_requested",
  "waived",
  "cancelled",
];

interface Props {
  loanId: string;
}

export function LoanAppraisalCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: rows = [], isLoading } = useAppraisalOrders(loanId);
  const { insertOne, updateRow, removeRow } = useAppraisalOrderMutations(loanId);

  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");

  if (!canView) return null;

  const add = async () => {
    try {
      await insertOne.mutateAsync({ vendor_name: vendor.trim() || null, notes: notes.trim() || null });
      toast.success("Appraisal line added.");
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
          <ClipboardList className="h-4 w-4" />
          Appraisal
        </CardTitle>
        <CardDescription>AMC / appraiser tracking. Full vendor hook is off until enabled in Integrations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canMutate ? (
          <div className="space-y-2 border-b pb-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Vendor</Label>
                <Input className="h-9" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="AMC or appraiser" />
              </div>
              <Button className="h-9 self-end" type="button" onClick={() => void add()} disabled={insertOne.isPending}>
                Add row
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
                <div className="flex justify-between gap-2">
                  <Select
                    value={r.status}
                    disabled={!canMutate}
                    onValueChange={(v) =>
                      void updateRow
                        .mutateAsync({ id: r.id, status: v as AppraisalOrderStatus })
                        .then(() => toast.success("Updated"))
                        .catch((e) => toast.error(String(e)))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[200px] max-w-full">
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
                      className="h-7 text-xs text-destructive shrink-0"
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
                    <Label className="text-xs">AMC ref</Label>
                    <Input
                      className="h-8 text-xs"
                      defaultValue={r.amc_reference ?? ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.amc_reference ?? "")) void updateRow.mutateAsync({ id: r.id, amc_reference: v || null });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fee</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      defaultValue={r.appraisal_fee != null ? String(r.appraisal_fee) : ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const n = raw === "" ? null : Number(raw);
                        if (n !== null && Number.isNaN(n)) return;
                        const prev = r.appraisal_fee != null ? Number(r.appraisal_fee) : null;
                        if (n !== prev) void updateRow.mutateAsync({ id: r.id, appraisal_fee: n });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inspection date</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      defaultValue={r.inspection_date?.slice(0, 10) ?? ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const d = e.target.value;
                        void updateRow.mutateAsync({ id: r.id, inspection_date: d ? d : null });
                      }}
                    />
                  </div>
                </div>
                {r.notes ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p> : null}
              </li>
            ))}
            {rows.length === 0 ? <p className="text-xs text-muted-foreground">No appraisal rows.</p> : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
