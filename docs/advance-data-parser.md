# Advance Data Parser — Knowledge Base

Universal document ingestion via `parse-document` edge function.

## Supported formats

| Format | Handler | Parser metadata |
|--------|---------|-----------------|
| PDF | **pdf-parse** (spec: pdf-parse/pdfminer) | `parser: pdf-parse` |
| DOCX | mammoth | `parser: mammoth` |
| XLSX | xlsx | `parser: xlsx` |
| PPTX | JSZip slide XML | `parser: pptx` |
| TXT / MD | UTF-8 | (none) |
| JSON | JSON.parse | (none) |

**Note:** pdfminer is Python-only; Supabase Edge uses **pdf-parse** (pdf.js-based) as the PDF file-type handler per platform spec. If pdf-parse fails at runtime, **unpdf** is used as fallback (`engine: unpdf-fallback` in metadata).

Legacy **.doc** is rejected — use **.docx**.

## Deploy after merge

```bash
npx supabase functions deploy parse-document
```

Re-parse existing PDFs via article detail → **Extract text again** to refresh parser metadata.

## Verify

- Upload PDF → extract preview shows `Parser: pdf-parse · Spec: pdf-parse/pdfminer`
- Sections tab has per-page chunks
- Agent question returns document_extract excerpt
