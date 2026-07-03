export function monthlyPrincipalAndInterest(input: {
  loanAmount: number;
  annualRatePct: number;
  termYears: number;
}): number {
  const principal = Math.max(0, input.loanAmount);
  const monthlyRate = Math.max(0, input.annualRatePct) / 100 / 12;
  const months = Math.max(1, Math.round(input.termYears * 12));
  if (principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const factor = (1 + monthlyRate) ** months;
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function safeNumber(value: string, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
