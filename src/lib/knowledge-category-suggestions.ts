import type { KnowledgeCategory } from "@/hooks/useKnowledge";

interface SuggestionSignalInput {
  title?: string;
  content?: string;
  summary?: string;
  tags?: string[];
}

interface CategorySuggestion {
  categoryId: string;
  score: number;
  reason: string;
}

const DOMAIN_RULES: Array<{ keywords: string[]; slugs: string[]; reason: string }> = [
  {
    keywords: ["underwriting", "condition", "w2", "income", "assets", "credit", "doc", "document"],
    slugs: [
      "documents-and-conditions",
      "income-documents",
      "asset-documents",
      "credit-documents",
      "condition-clearing",
    ],
    reason: "Matched document and underwriting terms",
  },
  {
    keywords: ["pricing", "rate", "lock", "investor", "best execution", "rate sheet"],
    slugs: ["product-and-pricing", "lock-policy", "rate-sheet-operations"],
    reason: "Matched pricing and rate-lock terms",
  },
  {
    keywords: ["pipeline", "milestone", "sla", "turn time", "escalation", "risk"],
    slugs: ["operations-and-risk", "pipeline-prioritization", "sla-and-turn-times", "escalations"],
    reason: "Matched pipeline and risk operations terms",
  },
  {
    keywords: ["borrower", "realtor", "status update", "closing notice", "email template"],
    slugs: ["borrower-communication", "status-updates", "condition-requests", "closing-notices"],
    reason: "Matched communication workflow terms",
  },
  {
    keywords: ["application", "processing", "closing", "post-closing", "loan lifecycle"],
    slugs: ["loan-lifecycle", "application", "processing", "closing", "post-closing"],
    reason: "Matched lifecycle stage terms",
  },
];

function normalizeText(input: SuggestionSignalInput): string {
  return [input.title, input.summary, input.content, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function suggestKnowledgeCategories(
  categories: KnowledgeCategory[],
  input: SuggestionSignalInput,
): CategorySuggestion[] {
  const text = normalizeText(input);
  if (!text) return [];

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const scored = new Map<string, CategorySuggestion>();

  for (const rule of DOMAIN_RULES) {
    const matches = rule.keywords.filter((k) => text.includes(k));
    if (matches.length === 0) continue;
    const ruleScore = Math.min(1, matches.length / 3);

    for (const slug of rule.slugs) {
      const category = categoryBySlug.get(slug);
      if (!category) continue;

      const existing = scored.get(category.id);
      const nextScore = Math.max(existing?.score ?? 0, ruleScore);
      scored.set(category.id, {
        categoryId: category.id,
        score: nextScore,
        reason: rule.reason,
      });
    }
  }

  return Array.from(scored.values()).sort((a, b) => b.score - a.score);
}
