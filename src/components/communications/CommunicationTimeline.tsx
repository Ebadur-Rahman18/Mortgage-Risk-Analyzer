// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { BORROWER_COMMUNICATION_DOC_TYPES } from "@/lib/borrowerCommunicationPrompt";
import {
  useBorrowerCommunicationsByLoan,
  useBorrowerCommunicationsByBorrower,
  type BorrowerCommunicationListRow,
} from "@/hooks/useBorrowerCommunications";
import {
  Mail,
  MailCheck,
  MailX,
  Clock,
  FileEdit,
  AlertCircle,
  Loader2,
  MessageSquare,
} from "lucide-react";

function docTypeLabel(value: string) {
  return BORROWER_COMMUNICATION_DOC_TYPES.find((d) => d.value === value)?.label ?? value;
}

function statusIcon(status: string) {
  switch (status) {
    case "sent":
      return <MailCheck className="h-4 w-4 text-green-600" />;
    case "approved":
      return <Mail className="h-4 w-4 text-blue-600" />;
    case "rejected":
      return <MailX className="h-4 w-4 text-red-500" />;
    case "needs_revision":
      return <FileEdit className="h-4 w-4 text-amber-500" />;
    case "draft":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "sent":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

function TimelineItem({ row, showLoan }: { row: BorrowerCommunicationListRow; showLoan?: boolean }) {
  const loanNumber = row.loans?.loan_number ?? "—";

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
          {statusIcon(row.status)}
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-medium">{docTypeLabel(row.doc_type)}</span>
          <Badge variant={statusVariant(row.status)} className="text-xs">
            {row.status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">{row.channel}</span>
        </div>
        {showLoan && (
          <p className="text-xs text-muted-foreground mb-1">
            Loan{" "}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/loans/${row.loan_id}`}>
              {loanNumber}
            </Link>
          </p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {row.draft_content.slice(0, 160)}
          {row.draft_content.length > 160 ? "…" : ""}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {row.sent_at ? `Sent ${formatDate(row.sent_at)}` : `Created ${formatDate(row.created_at)}`}
        </p>
      </div>
    </div>
  );
}

interface CommunicationTimelineProps {
  loanId?: string;
  borrowerId?: string;
  showLoan?: boolean;
  title?: string;
  className?: string;
}

export function CommunicationTimeline({
  loanId,
  borrowerId,
  showLoan = false,
  title = "Communication Timeline",
  className,
}: CommunicationTimelineProps) {
  const loanQuery = useBorrowerCommunicationsByLoan(loanId);
  const borrowerQuery = useBorrowerCommunicationsByBorrower(borrowerId);

  const query = loanId ? loanQuery : borrowerQuery;
  const { data: items, isLoading } = query;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !items?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No communications yet.
          </p>
        ) : (
          <div className="space-y-0">
            {items.map((row) => (
              <TimelineItem key={row.id} row={row} showLoan={showLoan} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
