import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ComplianceScreeningRow, ComplianceCheckItem } from "@/hooks/useComplianceScreening";

function resultLabel(r: string): string {
  switch (r) {
    case "pass": return "PASS";
    case "warning": return "WARNING";
    case "fail": return "FAIL";
    default: return r.toUpperCase();
  }
}

function resultColorRgb(r: string): [number, number, number] {
  switch (r) {
    case "pass": return [34, 139, 34];
    case "warning": return [200, 150, 0];
    case "fail": return [200, 30, 30];
    default: return [100, 100, 100];
  }
}

export function generateCompliancePdf(
  data: ComplianceScreeningRow,
  loanNumber?: string,
  borrowerName?: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Compliance Screening Report", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const infoLines = [
    `Loan: ${loanNumber ?? data.loan_id}`,
    borrowerName ? `Borrower: ${borrowerName}` : null,
    `Date: ${new Date(data.created_at).toLocaleDateString()}`,
    `Overall: ${resultLabel(data.overall_result)} (${data.pass_count} pass, ${data.warn_count} warning, ${data.fail_count} fail)`,
  ].filter(Boolean) as string[];

  for (const line of infoLines) {
    doc.text(line, 14, y);
    y += 5;
  }
  y += 3;

  const [r, g, b] = resultColorRgb(data.overall_result);
  doc.setFillColor(r, g, b);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, "F");
  doc.text(
    data.overall_result === "pass"
      ? "COMPLIANT"
      : data.overall_result === "warning"
        ? "WARNINGS PRESENT — REVIEW RECOMMENDED"
        : "NON-COMPLIANT — ISSUES FOUND",
    pageWidth / 2,
    y + 7,
    { align: "center" },
  );
  y += 16;

  doc.setTextColor(0, 0, 0);

  const groups = ["TRID", "HMDA", "Fair Lending"];

  for (const group of groups) {
    const groupChecks = (data.checks as ComplianceCheckItem[]).filter(
      (c) => c.regulation_group === group,
    );
    if (groupChecks.length === 0) continue;

    if (y > 250) { doc.addPage(); y = 15; }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(group, 14, y);
    y += 6;

    const tableData = groupChecks.map((check) => [
      check.code,
      check.name,
      resultLabel(check.result),
      check.actual_value,
      check.issue_note || "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Code", "Check", "Result", "Actual", "Issue Notes"]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 35 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 35 },
        4: { cellWidth: "auto" },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const val = hookData.cell.raw as string;
          if (val === "PASS") hookData.cell.styles.textColor = [34, 139, 34];
          else if (val === "WARNING") hookData.cell.styles.textColor = [200, 150, 0];
          else if (val === "FAIL") hookData.cell.styles.textColor = [200, 30, 30];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 8;
  }

  if (data.ai_summary) {
    if (y > 260) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("AI Summary", 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(data.ai_summary, pageWidth - 28);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 4 + 4;
  }

  if (data.ai_remediation?.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("AI Remediation Notes", 14, y);
    y += 6;

    for (const rem of data.ai_remediation) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${rem.code}:`, 14, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(rem.recommendation, pageWidth - 32);
      doc.text(lines, 18, y + 4);
      y += 4 + lines.length * 4 + 2;
      if (rem.citation_ref) {
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(`Ref: ${rem.citation_ref}`, 18, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by Control Tower · Compliance Report · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  doc.save(`compliance-${loanNumber ?? data.loan_id}-${new Date().toISOString().split("T")[0]}.pdf`);
}
