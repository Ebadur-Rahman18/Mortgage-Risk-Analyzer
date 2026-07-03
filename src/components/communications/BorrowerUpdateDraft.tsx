// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useBorrowerCommunicationLifecycle,
  useUpdateBorrowerCommunicationDraft,
  useSendBorrowerEmail,
  type BorrowerCommunicationListRow,
} from "@/hooks/useBorrowerCommunications";
import {
  BORROWER_COMMUNICATION_DOC_TYPES,
  normalizeGeneratedDraftContent,
} from "@/lib/borrowerCommunicationPrompt";
import { formatDate } from "@/lib/utils";
import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

function docTypeLabel(value: string) {
  return BORROWER_COMMUNICATION_DOC_TYPES.find((d) => d.value === value)?.label ?? value;
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
    case "needs_revision":
      return "outline";
    default:
      return "outline";
  }
}

function parseMissingNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return notes.filter((x): x is string => typeof x === "string");
}

export function BorrowerUpdateDraft({ row }: { row: BorrowerCommunicationListRow }) {
  const [text, setText] = useState(normalizeGeneratedDraftContent(row.draft_content));
  const saveDraft = useUpdateBorrowerCommunicationDraft();
  const lifecycle = useBorrowerCommunicationLifecycle();
  const sendEmail = useSendBorrowerEmail();

  useEffect(() => {
    setText(normalizeGeneratedDraftContent(row.draft_content));
  }, [row.id, row.draft_content]);

  const loanNumber = row.loans?.loan_number ?? "—";
  const borrower =
    row.loans?.borrowers &&
    [row.loans.borrowers.first_name, row.loans.borrowers.last_name].filter(Boolean).join(" ");

  const missing = parseMissingNotes(row.missing_data_notes);
  const busy = saveDraft.isPending || lifecycle.isPending || sendEmail.isPending;
  const normalizedOriginalText = normalizeGeneratedDraftContent(row.draft_content);

  const handleSave = () => {
    if (text === normalizedOriginalText) return;
    saveDraft.mutate({ id: row.id, draft_content: text });
  };

  const runLifecycle = (
    action: "approve" | "reject" | "needs_revision" | "mark_sent",
  ) => {
    lifecycle.mutate({
      communication_id: row.id,
      action,
      draft_content: text !== normalizedOriginalText ? text : undefined,
    });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Review draft</CardTitle>
          <Badge variant={statusVariant(row.status)}>{row.status.replace("_", " ")}</Badge>
        </div>
        <CardDescription>
          {docTypeLabel(row.doc_type)} · {row.channel} · {row.audience}
          {row.confidence && (
            <span className="text-muted-foreground"> · confidence: {row.confidence}</span>
          )}
        </CardDescription>
        <p className="text-sm text-muted-foreground">
          Loan{" "}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/loans/${row.loan_id}`}>
            {loanNumber}
          </Link>
          {borrower ? ` · ${borrower}` : null}
          {" · "}
          {formatDate(row.created_at)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <p className="font-medium text-amber-900 dark:text-amber-100">Missing or uncertain data</p>
            <ul className="mt-1 list-inside list-disc text-amber-800 dark:text-amber-200">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          className="font-mono text-sm"
          disabled={row.status === "sent" || row.status === "rejected"}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              toast.success("Copied to clipboard");
            });
          }}
          disabled={!text}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSave}
          disabled={
            busy ||
            row.status === "sent" ||
            row.status === "rejected" ||
            text === normalizedOriginalText
          }
        >
          {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save edits"}
        </Button>
        {row.status === "draft" || row.status === "needs_revision" ? (
          <>
            <Button type="button" onClick={() => runLifecycle("approve")} disabled={busy}>
              Approve
            </Button>
            <Button type="button" variant="outline" onClick={() => runLifecycle("needs_revision")} disabled={busy}>
              Needs revision
            </Button>
            <Button type="button" variant="destructive" onClick={() => runLifecycle("reject")} disabled={busy}>
              Reject
            </Button>
          </>
        ) : null}
        {row.status === "approved" ? (
          <>
            <Button
              type="button"
              onClick={() => sendEmail.mutate(row.id)}
              disabled={busy}
              className="gap-2"
            >
              {sendEmail.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Email
            </Button>
            <Button type="button" variant="outline" onClick={() => runLifecycle("mark_sent")} disabled={busy}>
              Mark sent (manual)
            </Button>
            <Button type="button" variant="outline" onClick={() => runLifecycle("needs_revision")} disabled={busy}>
              Back to revision
            </Button>
            <Button type="button" variant="destructive" onClick={() => runLifecycle("reject")} disabled={busy}>
              Reject
            </Button>
          </>
        ) : null}
        <p className="w-full text-xs text-muted-foreground">
          {row.status === "approved"
            ? "Send Email delivers the draft to the borrower via SendGrid. Use Mark sent (manual) if you sent it outside the system."
            : "Approve the draft, then use Send Email to deliver it to the borrower."}
        </p>
      </CardFooter>
    </Card>
  );
}
