// MCT Lite: hidden-module-safe export helpers.
// @ts-nocheck

export type PipelineExportLoan = Record<string, any>;

export function pipelineExportFilename(prefix = "pipeline-export") {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}`;
}

function downloadTextFile(contents: string, filename: string, mimeType: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, any>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row ?? {}))));
  if (headers.length === 0) return "";
  const escape = (value: any) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row?.[header])).join(","))].join("\n");
}

export function exportLoanPipelineToCSV(rows: PipelineExportLoan[], baseFilename: string) {
  downloadTextFile(toCsv(rows), `${baseFilename}.csv`, "text/csv;charset=utf-8");
}

export function exportLoanPipelineToExcel(rows: PipelineExportLoan[], baseFilename: string) {
  downloadTextFile(toCsv(rows), `${baseFilename}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

export function exportManagerDashboardSummaryToCSV(summary: Record<string, any>, baseFilename: string) {
  const rows = Object.entries(summary ?? {}).map(([section, value]) => ({
    section,
    value: typeof value === "string" ? value : JSON.stringify(value ?? null),
  }));
  downloadTextFile(toCsv(rows), `${baseFilename}.csv`, "text/csv;charset=utf-8");
}
