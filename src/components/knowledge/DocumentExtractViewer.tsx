import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Braces,
  Copy,
  Download,
  FileText,
  Layers,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  buildExtractExportPayload,
  downloadTextFile,
  type DocumentExtractViewModel,
} from "@/lib/document-extract-utils";

interface DocumentExtractViewerProps {
  extract: DocumentExtractViewModel;
  compact?: boolean;
  showRagHint?: boolean;
}

export function DocumentExtractViewer({
  extract,
  compact = false,
  showRagHint = true,
}: DocumentExtractViewerProps) {
  const [copied, setCopied] = useState(false);
  const baseName = (extract.file_name ?? "document").replace(/\.[^/.]+$/, "");

  const exportJson = useMemo(
    () => JSON.stringify(buildExtractExportPayload(extract), null, 2),
    [extract],
  );

  const ragReady =
    extract.parse_status === "done" && (extract.extracted_text?.trim().length ?? 0) > 0;

  const handleCopyText = async () => {
    const text = extract.extracted_text?.trim() ?? "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Extracted text copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={extract.parse_status === "done" ? "secondary" : "outline"}>
          {extract.parse_status}
        </Badge>
        {extract.page_count != null && (
          <Badge variant="outline">{extract.page_count} pages</Badge>
        )}
        {extract.word_count != null && (
          <Badge variant="outline">{extract.word_count.toLocaleString()} words</Badge>
        )}
        {extract.parsed_at && (
          <span className="text-xs text-muted-foreground">
            Parsed {formatDate(extract.parsed_at)}
          </span>
        )}
        {showRagHint && ragReady && (
          <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
            <Bot className="h-3 w-3" />
            Ready for AI agents
          </Badge>
        )}
      </div>

      {extract.parse_error && (
        <p className="text-sm text-destructive">{extract.parse_error}</p>
      )}

      {ragReady && showRagHint && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
          This extracted text is indexed for the Knowledge Base agent tool and searchable
          content. Ask an AI agent questions about this document after upload.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!extract.extracted_text}
          onClick={() =>
            downloadTextFile(`${baseName}-extracted.txt`, extract.extracted_text ?? "")
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Download .txt
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadTextFile(`${baseName}-extract.json`, exportJson, "application/json")}
        >
          <Braces className="mr-2 h-4 w-4" />
          Download JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!extract.extracted_text}
          onClick={() => void handleCopyText()}
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "Copied" : "Copy text"}
        </Button>
      </div>

      <Tabs defaultValue="sections" className="w-full">
        <TabsList className={compact ? "grid w-full grid-cols-4" : undefined}>
          <TabsTrigger value="sections" className="gap-1">
            <Layers className="h-3.5 w-3.5" />
            Sections
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1">
            <FileText className="h-3.5 w-3.5" />
            Full text
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-1">
            <Table2 className="h-3.5 w-3.5" />
            Tables
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-1">
            <Braces className="h-3.5 w-3.5" />
            Raw JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="mt-3">
          {extract.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No structured sections returned.</p>
          ) : (
            <Accordion type="multiple" className="rounded-md border px-2">
              {extract.sections.map((section, idx) => (
                <AccordionItem key={`${section.title ?? "section"}-${idx}`} value={`s-${idx}`}>
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <span className="flex items-center gap-2 text-left">
                      {section.title ?? `Section ${idx + 1}`}
                      {section.page != null && (
                        <Badge variant="outline" className="font-normal">
                          p.{section.page}
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-xs">
                      {section.text}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="text" className="mt-3">
          <ScrollArea className={compact ? "h-48 rounded-md border" : "h-96 rounded-md border"}>
            <pre className="whitespace-pre-wrap p-4 text-sm">
              {extract.extracted_text?.trim() || "—"}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tables" className="mt-3">
          {extract.tables_json.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tables extracted from this file.</p>
          ) : (
            <div className="space-y-4">
              {extract.tables_json.map((table, idx) => (
                <div key={idx} className="rounded-md border p-3">
                  {table.title && (
                    <p className="mb-2 text-sm font-medium">{String(table.title)}</p>
                  )}
                  {Array.isArray(table.rows) && table.rows.length > 0 ? (
                    <ScrollArea className="max-h-64">
                      <table className="w-full text-xs">
                        <tbody>
                          {(table.rows as unknown[][]).slice(0, 50).map((row, ri) => (
                            <tr key={ri} className="border-b last:border-0">
                              {(Array.isArray(row) ? row : []).map((cell, ci) => (
                                <td key={ci} className="px-2 py-1 align-top">
                                  {cell == null ? "" : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  ) : (
                    <pre className="text-xs">{JSON.stringify(table, null, 2)}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-3">
          <ScrollArea className={compact ? "h-48 rounded-md border" : "h-96 rounded-md border"}>
            <pre className="p-4 text-xs font-mono">{exportJson}</pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {extract.metadata && Object.keys(extract.metadata).length > 0 && (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Parser: {String(extract.metadata.parser ?? extract.metadata.engine ?? "unknown")}
          {extract.metadata.engine === "unpdf-fallback" && (
            <> · Fallback engine: unpdf</>
          )}
          {extract.metadata.sheets != null && (
            <> · Sheets: {JSON.stringify(extract.metadata.sheets)}</>
          )}
        </div>
      )}
    </div>
  );
}
