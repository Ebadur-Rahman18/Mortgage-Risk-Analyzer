import { useState, useRef } from "react";
import { useDocumentTypes, useUploadLoanDocument } from "@/hooks/useLoanDocuments";
import { useLoanConditions } from "@/hooks/useLoanConditions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText } from "lucide-react";

interface Props {
  loanId: string;
  borrowerId?: string;
  trigger?: React.ReactNode;
}

export function DocumentUploadDialog({ loanId, borrowerId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const { data: docTypes = [] } = useDocumentTypes();
  const { data: conditions = [] } = useLoanConditions(loanId);
  const uploadMutation = useUploadLoanDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  const [typeId, setTypeId] = useState("");
  const [conditionId, setConditionId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = () => {
    if (!file || !typeId) return;
    uploadMutation.mutate(
      {
        loanId,
        borrowerId,
        documentTypeId: typeId,
        file,
        conditionId: conditionId || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setFile(null);
          setTypeId("");
          setConditionId("");
        },
      }
    );
  };

  const grouped = docTypes.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, typeof docTypes>);

  const pendingConditions = conditions.filter((c) => c.status === "pending");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Upload className="mr-1 h-4 w-4" /> Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Loan Document</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Document Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(grouped).map(([category, types]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{category}</div>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pendingConditions.length > 0 && (
            <div>
              <Label>Link to Condition (optional)</Label>
              <Select value={conditionId} onValueChange={setConditionId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {pendingConditions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      [{c.condition_type}] {c.description.slice(0, 60)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>File</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
              <FileText className="mr-2 h-4 w-4" />
              {file ? file.name : "Choose file..."}
            </Button>
            {file && <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>}
          </div>

          <Button onClick={handleUpload} disabled={!file || !typeId || uploadMutation.isPending} className="w-full">
            {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
