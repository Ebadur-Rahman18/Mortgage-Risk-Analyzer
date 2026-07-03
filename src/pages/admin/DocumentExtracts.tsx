import { useState } from "react";
import { Link } from "react-router-dom";
import { useDocumentExtractsAdmin } from "@/hooks/useKnowledge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Braces, RefreshCw } from "lucide-react";

type ExtractRow = {
  id: string;
  parse_status: string | null;
  parse_error: string | null;
  word_count: number | null;
  page_count: number | null;
  file_name: string | null;
  extracted_text: string | null;
  sections: unknown;
  tables_json: unknown;
  metadata: unknown;
  parsed_at: string | null;
  knowledge_entry_id: string | null;
  knowledge_entries: { id: string; title: string; slug: string } | null;
};

export default function DocumentExtracts() {
  const { data = [], isLoading, error, refetch, isFetching } = useDocumentExtractsAdmin(300);
  const [jsonOpen, setJsonOpen] = useState<null | { title: string; body: string }>(null);
  const [textOpen, setTextOpen] = useState<null | { title: string; body: string }>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Document extracts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Server-parsed text, word counts, and structured sections/tables from knowledge uploads.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Extracted documents</CardTitle>
          <CardDescription>
            Open JSON for sections/tables metadata, or full text for the raw extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No document extracts yet. Upload files from the knowledge base.</p>
          ) : (
            <ScrollArea className="h-[min(70vh,720px)] w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Words</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead>Parsed</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data as ExtractRow[]).map((row) => {
                    const entry = row.knowledge_entries;
                    const status = row.parse_status ?? "—";
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge variant={status === "done" ? "secondary" : status === "error" ? "destructive" : "outline"}>
                            {status}
                          </Badge>
                          {row.parse_error && status === "error" && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={row.parse_error}>
                              {row.parse_error}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry ? (
                            <Link className="text-primary hover:underline" to={`/knowledge/${entry.id}`}>
                              {entry.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate" title={row.file_name ?? ""}>
                          {row.file_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{row.word_count ?? "—"}</TableCell>
                        <TableCell className="text-right">{row.page_count ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {row.parsed_at ? new Date(row.parsed_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!row.extracted_text}
                            onClick={() =>
                              setTextOpen({
                                title: row.file_name ?? "Extracted text",
                                body: row.extracted_text ?? "",
                              })
                            }
                          >
                            Text
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setJsonOpen({
                                title: row.file_name ?? "Sections / tables",
                                body: JSON.stringify(
                                  { sections: row.sections, tables_json: row.tables_json, metadata: row.metadata },
                                  null,
                                  2,
                                ),
                              })
                            }
                          >
                            <Braces className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!textOpen} onOpenChange={(o) => !o && setTextOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{textOpen?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh] rounded border p-3">
            <pre className="text-xs whitespace-pre-wrap font-mono">{textOpen?.body}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!jsonOpen} onOpenChange={(o) => !o && setJsonOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Braces className="h-5 w-5" />
              {jsonOpen?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh] rounded border p-3">
            <pre className="text-xs whitespace-pre-wrap font-mono">{jsonOpen?.body}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
