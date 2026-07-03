import { usePendingDocumentReviews, useReviewLoanDocument, getLoanDocumentSignedUrl } from "@/hooks/useLoanDocuments";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Download, CheckCircle, XCircle, FileText, ExternalLink, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function DocumentReviewQueue() {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = usePendingDocumentReviews();
  const reviewMutation = useReviewLoanDocument();

  const handleDownload = async (filePath: string) => {
    const url = await getLoanDocumentSignedUrl(filePath);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Review Queue</h1>
          <p className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""} pending review
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No documents pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-md bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.document_types?.name ?? "Unknown type"} · Uploaded {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {doc.source}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/loans/${doc.loan_id}`}>
                      <ExternalLink className="mr-1 h-3 w-3" /> Loan
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.file_path)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => reviewMutation.mutate({ id: doc.id, loanId: doc.loan_id, status: "accepted" })}
                    disabled={reviewMutation.isPending}
                  >
                    <CheckCircle className="mr-1 h-4 w-4" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => reviewMutation.mutate({ id: doc.id, loanId: doc.loan_id, status: "rejected" })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
