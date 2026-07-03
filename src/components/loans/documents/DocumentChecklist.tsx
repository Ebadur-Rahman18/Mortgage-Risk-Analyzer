import { useProgramDocRequirements, useLoanDocuments } from "@/hooks/useLoanDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  loanId: string;
  programId: string | null | undefined;
}

export function DocumentChecklist({ loanId, programId }: Props) {
  const { data: requirements = [], isLoading: reqLoading } = useProgramDocRequirements(programId);
  const { data: documents = [], isLoading: docsLoading } = useLoanDocuments(loanId);

  if (!programId) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Select a loan program to see the document checklist.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (reqLoading || docsLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (requirements.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            No document requirements configured for this program.
          </p>
        </CardContent>
      </Card>
    );
  }

  const docsByType = documents.reduce((acc, d) => {
    if (!acc[d.document_type_id]) acc[d.document_type_id] = [];
    acc[d.document_type_id].push(d);
    return acc;
  }, {} as Record<string, typeof documents>);

  const fulfilled = requirements.filter((r) => {
    const docs = docsByType[r.document_type_id] ?? [];
    return docs.some((d) => d.review_status === "accepted");
  }).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Document Checklist
          <Badge variant="outline">
            {fulfilled}/{requirements.length} complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requirements.map((req) => {
            const docs = docsByType[req.document_type_id] ?? [];
            const accepted = docs.find((d) => d.review_status === "accepted");
            const pending = docs.find((d) => d.review_status === "pending");
            const hasAny = docs.length > 0;

            let status: "complete" | "pending" | "missing";
            if (accepted) status = "complete";
            else if (pending || hasAny) status = "pending";
            else status = "missing";

            return (
              <div key={req.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  {status === "complete" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : status === "pending" ? (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {req.document_types?.name ?? "Unknown"}
                    </p>
                    {req.description && (
                      <p className="text-xs text-muted-foreground">{req.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.is_required ? (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Optional</Badge>
                  )}
                  {status === "complete" && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Accepted
                    </Badge>
                  )}
                  {status === "pending" && (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Pending Review
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
