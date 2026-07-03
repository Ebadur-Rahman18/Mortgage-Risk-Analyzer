import { createContext, useContext, ReactNode } from "react";
import { useAppConfig } from "@/hooks/useAppConfig";

interface BrandingContextType {
  companyName: string;
  shortName: string;
  tagline: string;
  supportEmail: string;
  logoUrl?: string;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: config, isLoading } = useAppConfig();

  const value: BrandingContextType = {
    companyName: config?.branding?.companyName || "MortgageAI Control Tower",
    shortName: (config?.branding as any)?.shortName || "Control Tower",
    tagline: config?.branding?.tagline || "Your loan pipeline. Simplified.",
    supportEmail: config?.branding?.supportEmail || "support@mortgagecontroltower.com",
    logoUrl: (config?.branding as any)?.logoUrl,
    isLoading,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
}
