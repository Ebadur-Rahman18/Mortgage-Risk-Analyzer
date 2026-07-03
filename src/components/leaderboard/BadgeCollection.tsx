import { BadgeIcon } from "./BadgeIcon";
import type { OfficerBadge, BadgeDefinition } from "@/hooks/useLeaderboard";

interface Props {
  earnedBadges: OfficerBadge[];
  allDefinitions: BadgeDefinition[];
  currentPeriodLabel?: string;
  size?: "sm" | "md" | "lg";
}

export function BadgeCollection({
  earnedBadges,
  allDefinitions,
  currentPeriodLabel,
  size = "md",
}: Props) {
  const earnedDefIds = new Set(earnedBadges.map((b) => b.badge_definition_id));

  return (
    <div className="flex flex-wrap gap-2">
      {allDefinitions.map((def) => {
        const earned = earnedDefIds.has(def.id);
        const matchingBadge = earnedBadges.find(
          (b) => b.badge_definition_id === def.id,
        );
        const isNew =
          earned &&
          currentPeriodLabel !== undefined &&
          matchingBadge?.period_label === currentPeriodLabel;

        return (
          <BadgeIcon
            key={def.id}
            iconName={def.icon_name}
            tier={def.tier}
            name={def.name}
            description={def.description}
            earned={earned}
            size={size}
            isNew={isNew}
          />
        );
      })}
    </div>
  );
}
