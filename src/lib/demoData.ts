import type { IntegrationSetting } from "@/hooks/useIntegrationSettings";

/** Loan/borrower rows seeded for empty-state UX. */
export const DEMO_LOAN_DATA_SOURCES = ["demo", "lendingpad_demo"] as const;

const HIDE_DEMO_PROVIDERS = ["lendingpad", "hubspot", "encompass"] as const;

export function isLosOrCrmConnected(setting: IntegrationSetting | null | undefined): boolean {
  if (!setting?.is_active) return false;
  if (setting.api_key?.trim() || setting.api_key_masked?.trim()) return true;
  const cfg = setting.config ?? {};
  if (typeof cfg.access_token === "string" && cfg.access_token.trim()) return true;
  if (typeof cfg.refresh_token === "string" && cfg.refresh_token.trim()) return true;
  if (typeof cfg.last_sync_at === "string" && cfg.last_sync_at.trim()) return true;
  return false;
}

/** True when a real LOS/CRM connection is configured — demo seeds should be hidden. */
export function shouldHideDemoData(settings: IntegrationSetting[] | undefined | null): boolean {
  if (!settings?.length) return false;
  return HIDE_DEMO_PROVIDERS.some((provider) => {
    const row = settings.find((s) => s.provider_name === provider);
    return isLosOrCrmConnected(row);
  });
}

/** PostgREST `in` list for excluding demo loan data sources. */
export function demoLoanSourcesInList(): string {
  return `(${DEMO_LOAN_DATA_SOURCES.join(",")})`;
}
