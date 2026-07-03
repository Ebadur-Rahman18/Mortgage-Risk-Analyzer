import type { AdverseDecision } from "@/hooks/useClosingExecution";

function decisionSentence(inst: string, decision: AdverseDecision | null | undefined, loanNumber: string): string {
  const ref = loanNumber.trim() ? ` (reference ${loanNumber.trim()})` : "";
  switch (decision) {
    case "denied":
      return `After careful consideration, ${inst} is unable to approve your application for credit${ref}.`;
    case "withdrawn":
      return `Your application${ref} is considered withdrawn based on the information on file.`;
    case "counteroffer_declined":
      return `Your application${ref} will not proceed because the credit terms offered were not accepted.`;
    case "other":
    default:
      return `This notice relates to your application for credit${ref}.`;
  }
}

export function buildAdverseActionNoticeDraft(input: {
  institutionName: string;
  loanNumber: string;
  applicantLabel: string;
  decision: AdverseDecision | null | undefined;
  reasonCodes: string[];
  narrative?: string | null;
  ecraNotice?: boolean;
}): string {
  const lines: string[] = [];
  const inst = input.institutionName.trim() || "[Institution name]";
  const applicant = input.applicantLabel.trim() || "Applicant";
  const decision = input.decision ?? "other";

  lines.push(`${inst}`);
  lines.push("");
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  lines.push("");
  lines.push(`Dear ${applicant},`);
  lines.push("");
  lines.push(`Thank you for your interest in ${inst}.`);
  lines.push("");
  lines.push(decisionSentence(inst, decision, input.loanNumber));
  lines.push("");
  if (input.reasonCodes.length) {
    lines.push("Principal reason(s) for this decision (summary):");
    input.reasonCodes.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
    lines.push("");
  }
  if (input.narrative?.trim()) {
    lines.push("Additional information:");
    lines.push(input.narrative.trim());
    lines.push("");
  }
  if (input.ecraNotice) {
    lines.push(
      "Under applicable law, you have the right to obtain a copy of your consumer report and to dispute inaccurate information. " +
        "Contact the consumer reporting agency listed in the separate notice you receive for details.",
    );
    lines.push("");
  }
  lines.push("Sincerely,");
  lines.push(inst);

  return lines.join("\n");
}
