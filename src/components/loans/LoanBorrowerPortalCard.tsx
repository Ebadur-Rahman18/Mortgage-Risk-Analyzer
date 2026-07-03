// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreatePortalInvite,
  useLoanBorrowerUploads,
  useReviewBorrowerUpload,
  getBorrowerUploadSignedUrl,
} from "@/hooks/useBorrowerPortalStaff";
import { alignPortalInviteLinkToCurrentHost } from "@/lib/borrowerPortalApi";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { formatDate } from "@/lib/utils";
import { Download, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

export function LoanBorrowerPortalCard({
  loanId,
  borrowerEmail,
}: {
  loanId: string;
  borrowerEmail?: string | null;
}) {
  const { hasPermission } = useEffectivePermissions();
  const canUpdate = hasPermission("loans:update");
  const createInvite = useCreatePortalInvite();
  const { data: uploads, isLoading } = useLoanBorrowerUploads(loanId);
  const review = useReviewBorrowerUpload(loanId);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [markReceivedById, setMarkReceivedById] = useState<Record<string, boolean>>({});

  const handleInvite = async () => {
    if (!borrowerEmail?.trim()) {
      toast.error("Borrower needs an email on file to use the portal.");
      return;
    }
    try {
      const res = await createInvite.mutateAsync(loanId);
      if (res.invite_link) {
        const link = alignPortalInviteLinkToCurrentHost(res.invite_link);
        await navigator.clipboard.writeText(link);
        toast.success("Portal link copied to clipboard.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create invite");
    }
  };

  const handleDownload = async (uploadId: string) => {
    try {
      const { signed_url, file_name } = await getBorrowerUploadSignedUrl(uploadId);
      window.open(signed_url, "_blank", "noopener,noreferrer");
      toast.success(`Opening ${file_name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  if (!canUpdate) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Borrower portal</CardTitle>
            <CardDescription>
              Send a secure link so the borrower can upload documents tied to this loan.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={createInvite.isPending}
            onClick={handleInvite}
          >
            {createInvite.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Create portal link
          </Button>
        </div>
        {!borrowerEmail?.trim() ? (
          <p className="text-sm text-amber-700 dark:text-amber-200">
            Add a borrower email before creating a portal link.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium">Borrower submissions</h4>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !uploads?.length ? (
            <p className="text-sm text-muted-foreground">No portal uploads yet.</p>
          ) : (
            <ul className="space-y-4">
              {uploads.map((u) => (
                <li key={u.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{u.file_name}</span>
                    <span className="text-muted-foreground">
                      {formatDate(u.submitted_at)} · {u.review_status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(u.id)}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      View / download
                    </Button>
                  </div>
                  {u.review_status === "pending_review" ? (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <Textarea
                        placeholder="Notes (optional, visible on reject)"
                        value={notesById[u.id] ?? ""}
                        onChange={(ev) =>
                          setNotesById((prev) => ({ ...prev, [u.id]: ev.target.value }))
                        }
                        rows={2}
                        className="text-sm"
                      />
                      {u.loan_condition_id ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`mr-${u.id}`}
                            checked={markReceivedById[u.id] ?? true}
                            onCheckedChange={(c) =>
                              setMarkReceivedById((prev) => ({
                                ...prev,
                                [u.id]: c === true,
                              }))
                            }
                          />
                          <Label htmlFor={`mr-${u.id}`} className="text-xs font-normal">
                            Mark linked condition as received
                          </Label>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate(
                              {
                                uploadId: u.id,
                                action: "accepted",
                                notes: notesById[u.id],
                                markConditionReceived: u.loan_condition_id
                                  ? markReceivedById[u.id] !== false
                                  : false,
                              },
                              {
                                onSuccess: () => toast.success("Marked accepted"),
                                onError: (e) =>
                                  toast.error(e instanceof Error ? e.message : "Update failed"),
                              },
                            )
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate(
                              {
                                uploadId: u.id,
                                action: "rejected",
                                notes: notesById[u.id],
                                markConditionReceived: false,
                              },
                              {
                                onSuccess: () => toast.success("Marked rejected"),
                                onError: (e) =>
                                  toast.error(e instanceof Error ? e.message : "Update failed"),
                              },
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
