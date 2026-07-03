import { useState } from "react";
import {
  FileSignature,
  Plus,
  Check,
  Clock,
  X,
  Eye,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLoanDisclosures, useSendDisclosureForSigning, type LoanDisclosure } from "@/hooks/useLoanDisclosures";

const STATUS_CFG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  pending: { label: "Pending", color: "text-muted-foreground", Icon: Clock },
  sent: { label: "Sent", color: "text-amber-600 dark:text-amber-400", Icon: Clock },
  viewed: { label: "Viewed", color: "text-blue-600 dark:text-blue-400", Icon: Eye },
  signed: { label: "Signed", color: "text-green-600 dark:text-green-400", Icon: Check },
  declined: { label: "Declined", color: "text-red-600 dark:text-red-400", Icon: X },
};

const DISCLOSURE_TYPES = [
  { value: "initial_disclosure", label: "Initial Disclosure" },
  { value: "closing_disclosure", label: "Closing Disclosure" },
  { value: "loan_estimate", label: "Loan Estimate" },
  { value: "intent_to_proceed", label: "Intent to Proceed" },
  { value: "right_to_cancel", label: "Right to Cancel" },
  { value: "other", label: "Other" },
];

interface Props {
  loanId: string;
  borrowerId: string | undefined;
}

export function LoanDisclosuresCard({ loanId, borrowerId }: Props) {
  const { data: disclosures = [], isLoading } = useLoanDisclosures(loanId);
  const sendMut = useSendDisclosureForSigning();
  const [open, setOpen] = useState(false);
  const [discType, setDiscType] = useState("initial_disclosure");
  const [title, setTitle] = useState("");

  function handleSend() {
    if (!title.trim()) return;
    sendMut.mutate(
      { loan_id: loanId, disclosure_type: discType, title: title.trim() },
      { onSuccess: () => { setOpen(false); setTitle(""); } },
    );
  }

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Disclosures (E-Sign)
        </CardTitle>
        {borrowerId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Send for Signing
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Send Disclosure for Signing</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Disclosure Type</Label>
                  <Select value={discType} onValueChange={setDiscType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISCLOSURE_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>
                          {dt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Initial Disclosure Package"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!title.trim() || sendMut.isPending} onClick={handleSend}>
                  {sendMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send via DocuSign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : disclosures.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No disclosures sent yet.
          </p>
        ) : (
          <div className="space-y-2">
            {disclosures.map((d: LoanDisclosure) => {
              const cfg = STATUS_CFG[d.status] || STATUS_CFG.pending;
              const StatusIcon = cfg.Icon;
              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    d.status === "signed" && "border-green-200 dark:border-green-800",
                  )}
                >
                  <StatusIcon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.disclosure_type.replace(/_/g, " ")}
                      {d.sent_at && ` · Sent ${fmtDate(d.sent_at)}`}
                      {d.signed_at && ` · Signed ${fmtDate(d.signed_at)}`}
                      {d.declined_at && ` · Declined ${fmtDate(d.declined_at)}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", cfg.color)}>
                    {cfg.label}
                  </Badge>
                  {d.signing_url && (d.status === "sent" || d.status === "viewed") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => window.open(d.signing_url!, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
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
