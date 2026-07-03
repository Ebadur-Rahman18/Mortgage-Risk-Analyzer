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
  useSettlementOrders,
  useSettlementOrderMutations,
  type SettlementOrderStatus,
  type SettlementOrderType,
} from "@/hooks/useClosingExecution";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { permissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { Loader2, Droplets } from "lucide-react";
import { Link } from "react-router-dom";

const TYPES: SettlementOrderType[] = ["flood", "title", "homeowners_insurance", "other"];
const STATUSES: SettlementOrderStatus[] = [
  "not_ordered",
  "ordered",
  "in_progress",
  "received",
  "cleared",
  "cancelled",
];

interface Props {
  loanId: string;
}

export function LoanSettlementOrdersCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: rows = [], isLoading } = useSettlementOrders(loanId);
  const { insertOne, updateRow, removeRow } = useSettlementOrderMutations(loanId);

  const [orderType, setOrderType] = useState<SettlementOrderType>("title");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");

  if (!canView) return null;

  const addRow = async () => {
    try {
      await insertOne.mutateAsync({
        order_type: orderType,
        vendor_name: vendor.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Order added.");
      setVendor("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplets className="h-4 w-4" />
          Flood, title &amp; HOI
        </CardTitle>
        <CardDescription>
          Manual order tracking for flood certification, title, and homeowners insurance. Optional vendors can be enabled
          in Integrations.
          {canMutate ? (
            <>
              {" "}
              Attach evidence under{" "}
              <Link className="text-primary underline font-medium" to={`/loans/${loanId}#loan-documents`}>
                Documents
              </Link>
              .
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canMutate ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end border-b pb-4">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={orderType} onValueChange={(v) => setOrderType(v as SettlementOrderType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Vendor (optional)</Label>
              <Input className="h-9" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" />
            </div>
            <Button className="h-9" type="button" onClick={() => void addRow()} disabled={insertOne.isPending}>
              Add order
            </Button>
            <div className="space-y-1 sm:col-span-4">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium capitalize">{String(r.order_type).replace(/_/g, " ")}</span>
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
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={r.status}
                      disabled={!canMutate}
                      onValueChange={(v) =>
                        void updateRow
                          .mutateAsync({ id: r.id, status: v as SettlementOrderStatus })
                          .then(() => toast.success("Updated"))
                          .catch((e) => toast.error(String(e)))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
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
                  </div>
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
                    <Label className="text-xs">Reference #</Label>
                    <Input
                      className="h-8 text-xs"
                      defaultValue={r.reference_number ?? ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.reference_number ?? "")) void updateRow.mutateAsync({ id: r.id, reference_number: v || null });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expected date</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      defaultValue={r.expected_date?.slice(0, 10) ?? ""}
                      disabled={!canMutate}
                      onBlur={(e) => {
                        const d = e.target.value;
                        void updateRow.mutateAsync({
                          id: r.id,
                          expected_date: d ? d : null,
                        });
                      }}
                    />
                  </div>
                </div>
                {r.notes ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p> : null}
              </li>
            ))}
            {rows.length === 0 ? <p className="text-xs text-muted-foreground">No settlement orders yet.</p> : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
