import { useMemo } from "react";
import { useIntegrationSettings } from "@/hooks/useIntegrationSettings";
import { shouldHideDemoData } from "@/lib/demoData";

/** Whether demo seed rows should be excluded from list queries. */
export function useHideDemoData(): boolean {
  const { data: settings } = useIntegrationSettings();
  return useMemo(() => shouldHideDemoData(settings), [settings]);
}
