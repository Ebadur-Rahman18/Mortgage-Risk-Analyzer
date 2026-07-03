import { Home, CreditCard } from "lucide-react";
import {
  DataFeedIntegrationCard,
  DataFeedIntegrationCardSkeleton,
  type DataFeedMeta,
} from "./DataFeedIntegrationCard";

// MCT Lite: only Freddie Mac and Credit Bureau are surfaced.
// Other providers (Fannie Mae, VOE/VOI, AVM, AUS DU/LPA, Investor/TPO, Hedge,
// Appraisal/AMC, Flood, Title, HOI, RON, eClose, Adverse Action) are intentionally
// hidden — re-enable by adding entries back to INTEGRATIONS.
const INTEGRATIONS: DataFeedMeta[] = [
  {
    provider: "freddie-mac",
    name: "Freddie Mac",
    description:
      "Mortgage rates, loan purchasing guidelines, and related data from your Freddie Mac–approved feed or aggregator.",
    icon: <Home className="h-5 w-5 text-blue-600" />,
    accentColor: "bg-blue-600",
    category: "GSE / Mortgage Rates",
  },
  {
    provider: "credit-bureau",
    name: "Credit Bureau",
    description:
      "Tri-merge credit reporting integration (Equifax, Experian, TransUnion) via your credit vendor or reseller API.",
    icon: <CreditCard className="h-5 w-5 text-rose-600" />,
    accentColor: "bg-rose-600",
    category: "Credit Reporting",
  },
];

interface IntegrationsGridProps {
  isLoading?: boolean;
}

export function IntegrationsGrid({ isLoading = false }: IntegrationsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <DataFeedIntegrationCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {INTEGRATIONS.map((meta) => (
        <DataFeedIntegrationCard key={meta.provider} meta={meta} />
      ))}
    </div>
  );
}
