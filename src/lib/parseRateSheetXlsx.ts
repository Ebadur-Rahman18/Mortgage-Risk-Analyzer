import * as XLSX from "xlsx";

/** First sheet → array of row objects using header row. */
export function parseRateSheetXlsxToRows(arrayBuffer: ArrayBuffer): Array<Record<string, string>> {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      o[String(k).trim()] = v == null ? "" : String(v).trim();
    }
    return o;
  });
}
