import { useState } from "react";
import { useLoanDocuments, useReviewLoanDocument, useDeleteLoanDocument, getLoanDocumentSignedUrl } from "@/hooks/useLoanDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { Loader2, Download, CheckCircle, XCircle, Trash2, Eye, FileText, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const REVIEW_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  needs_revision: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const CATEGORY_ICONS: Record<string, string> = {
  application: "bg-blue-50 text-blue-600",
  income: "bg-emerald-50 text-emerald-600",
  asset: "bg-purple-50 text-purple-600",
  property: "bg-amber-50 text-amber-600",
  identity: "bg-slate-50 text-slate-600",
  compliance: "bg-rose-50 text-rose-600",
  closing: "bg-indigo-50 text-indigo-600",
};

interface Props {
  loanId: string;
  borrowerId?: string;
}

export function LoanDocumentsPanel({ loanId, borrowerId }: Props) {
  const { data: documents = [], isLoading } = useLoanDocuments(loanId);
  const reviewMutation = useReviewLoanDocument();
  const deleteMutation = useDeleteLoanDocument();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "moderator";

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const url = await getLoanDocumentSignedUrl(filePath);
      window.open(url, "_blank");
    } catch {
      /* handled by hook */
    }
  };

  const grouped = documents.reduce((acc, doc) => {
    const cat = doc.document_types?.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Loan Documents ({documents.length})</CardTitle>
        <DocumentUploadDialog loanId={loanId} borrowerId={borrowerId} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, docs]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {category}
                </h4>
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`rounded-md p-2 ${CATEGORY_ICONS[category] ?? "bg-gray-50 text-gray-600"}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.document_types?.name ?? "Unknown type"} · v{doc.version}
                            {doc.source !== "manual" && ` · via ${doc.source}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={REVIEW_COLORS[doc.review_status] ?? ""}>
                          {doc.review_status}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {isAdmin && doc.review_status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => reviewMutation.mutate({ id: doc.id, loanId, status: "accepted" })}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => reviewMutation.mutate({ id: doc.id, loanId, status: "rejected" })}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate({ id: doc.id, loanId, filePath: doc.file_path })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
