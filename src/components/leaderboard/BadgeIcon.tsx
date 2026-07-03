import {
  Trophy,
  Target,
  Award,
  Crown,
  DollarSign,
  Gem,
  Sparkles,
  ShieldCheck,
  Zap,
  Star,
  Medal,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  target: Target,
  award: Award,
  crown: Crown,
  "dollar-sign": DollarSign,
  gem: Gem,
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
  zap: Zap,
  star: Star,
  medal: Medal,
};

const TIER_RING: Record<string, string> = {
  bronze: "ring-amber-600/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  silver: "ring-slate-400/60 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300",
  gold: "ring-yellow-400/80 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400",
};

interface Props {
  iconName: string;
  tier: "bronze" | "silver" | "gold";
  name: string;
  description?: string;
  earned?: boolean;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  isNew?: boolean;
}

export function BadgeIcon({
  iconName,
  tier,
  name,
  description,
  earned = true,
  size = "md",
  showTooltip = true,
  isNew = false,
}: Props) {
  const Icon = ICON_MAP[iconName] || Award;
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };

  const badge = (
    <div className="relative">
      <div
        className={cn(
          "flex items-center justify-center rounded-full ring-2 transition-all",
          sizeClasses[size],
          earned ? TIER_RING[tier] : "ring-muted bg-muted/50 text-muted-foreground opacity-40",
          isNew && "animate-pulse",
        )}
      >
        <Icon className={iconSizes[size]} />
      </div>
      {isNew && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      )}
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium text-xs">{name}</p>
          {description && (
            <p className="text-[10px] text-muted-foreground">{description}</p>
          )}
          {!earned && (
            <p className="text-[10px] text-muted-foreground italic mt-0.5">
              Not yet earned
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
