/**
 * PDF text extraction for parse-document.
 * Primary engine: pdf-parse (task spec: pdf-parse / pdfminer file-type handler).
 * pdfminer is Python-only; Supabase Edge uses pdf-parse (pdf.js-based) for the same role.
 * Fallback: unpdf when pdf-parse fails (e.g. edge runtime edge cases).
 */

import { Buffer } from 'node:buffer';

export type PdfSection = { title: string | null; page: number | null; text: string };

export type PdfExtractResult = {
  text: string;
  pageCount: number | null;
  sections: PdfSection[];
  parser: string;
  extraMeta: Record<string, unknown>;
};

type PdfPageRenderData = {
  getTextContent: (opts: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }) => Promise<{ items: Array<{ str?: string }> }>;
};

function sectionsFromPageTexts(pageTexts: string[]): PdfSection[] {
  const pages = pageTexts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (pages.length === 0) {
    return [{ title: 'Document', page: null, text: '' }];
  }
  return pages.map((text, i) => ({
    title: `Page ${i + 1}`,
    page: i + 1,
    text,
  }));
}

async function extractWithPdfParse(bytes: Uint8Array): Promise<PdfExtractResult> {
  const mod = await import('npm:pdf-parse@1.1.1');
  const pdfParse = (mod as { default?: (buf: Buffer, opts?: Record<string, unknown>) => Promise<{ text?: string; numpages?: number }> }).default;
  if (typeof pdfParse !== 'function') {
    throw new Error('pdf-parse module did not load');
  }

  const buffer = Buffer.from(bytes);
  const pageTexts: string[] = [];

  const data = await pdfParse(buffer, {
    pagerender: (pageData: PdfPageRenderData) =>
      pageData
        .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        .then((textContent) => {
          const text = textContent.items.map((item) => item.str ?? '').join(' ').trim();
          pageTexts.push(text);
          return text;
        }),
  });

  const fullText = (data.text ?? pageTexts.join('\n\n')).trim();
  const sections = sectionsFromPageTexts(pageTexts.length > 0 ? pageTexts : fullText ? [fullText] : []);

  return {
    text: fullText || sections.map((s) => s.text).join('\n\n'),
    pageCount: typeof data.numpages === 'number' ? data.numpages : sections.length,
    sections,
    parser: 'pdf-parse',
    extraMeta: {
      parser: 'pdf-parse',
      engine: 'pdf-parse',
      spec_handler: 'pdf-parse/pdfminer',
      pages: sections.length,
    },
  };
}

async function extractWithUnpdf(bytes: Uint8Array): Promise<PdfExtractResult> {
  const { extractText, getDocumentProxy } = await import('npm:unpdf@0.12.1');
  const pdf = await getDocumentProxy(bytes);

  let pageTexts: string[] = [];
  let pageCount: number | null = null;

  try {
    const perPage = await extractText(pdf, { mergePages: false }) as {
      totalPages?: number;
      text?: string | string[];
    };
    pageCount = typeof perPage?.totalPages === 'number' ? perPage.totalPages : null;
    if (Array.isArray(perPage?.text)) {
      pageTexts = perPage.text.map((p) => String(p).trim()).filter((p) => p.length > 0);
    }
  } catch {
    // fall through to merged extraction
  }

  if (pageTexts.length === 0) {
    const merged = await extractText(pdf, { mergePages: true }) as {
      totalPages?: number;
      text?: string;
    };
    pageCount = pageCount ?? (typeof merged?.totalPages === 'number' ? merged.totalPages : null);
    const full = (merged?.text ?? '').trim();
    pageTexts = full.split(/\f/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (pageTexts.length === 0 && full) pageTexts = [full];
  }

  const sections = sectionsFromPageTexts(pageTexts);
  const text = pageTexts.join('\n\n');

  return {
    text,
    pageCount: pageCount ?? pageTexts.length,
    sections,
    parser: 'pdf-parse',
    extraMeta: {
      parser: 'pdf-parse',
      engine: 'unpdf-fallback',
      spec_handler: 'pdf-parse/pdfminer',
      fallback_reason: 'pdf-parse unavailable or failed',
      pages: pageTexts.length,
    },
  };
}

/** Extract PDF text with per-page sections. Prefers pdf-parse per platform spec. */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtractResult> {
  try {
    const result = await extractWithPdfParse(bytes);
    if (!result.text.trim() && result.sections.every((s) => !s.text.trim())) {
      throw new Error('pdf-parse returned empty text');
    }
    return result;
  } catch (primaryErr) {
    console.warn('pdf-parse extraction failed, using unpdf fallback:', (primaryErr as Error)?.message ?? primaryErr);
    return extractWithUnpdf(bytes);
  }
}
