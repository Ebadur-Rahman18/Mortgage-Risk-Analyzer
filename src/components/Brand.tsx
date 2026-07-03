import logoUrl from "@/assets/mortgageai-logo.svg";
import { cn } from "@/lib/utils";

interface BrandProps {
  className?: string;
  logoClassName?: string;
  taglineClassName?: string;
  showTagline?: boolean;
  tagline?: string;
}

/**
 * Unified brand mark: MortgageAI logo with "Control Tower" label below.
 * Replaces the legacy "MCT Lite" wordmark across the app.
 */
export function Brand({
  className,
  logoClassName,
  taglineClassName,
  showTagline = true,
  tagline = "Control Tower",
}: BrandProps) {
  return (
    <div className={cn("flex flex-col items-start gap-0.5", className)}>
      <img
        src={logoUrl}
        alt="MortgageAI"
        className={cn("h-8 w-auto", logoClassName)}
      />
      {showTagline && (
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
            taglineClassName,
          )}
        >
          {tagline}
        </span>
      )}
    </div>
  );
}
