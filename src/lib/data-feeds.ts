export type DataFeedProviderId =
  | 'hubspot'
  | 'encompass'
  | 'freddie-mac'
  | 'fannie-mae'
  | 'credit-bureau'
  | 'voe-provider'
  | 'avm-provider'
  | 'aus-fannie-du'
  | 'aus-freddie-lp'
  | 'investor-tpo-connector'
  | 'hedge-data-vendor'
  | 'appraisal-amc-stub'
  | 'flood-cert-vendor-stub'
  | 'title-vendor-stub'
  | 'homeowners-insurance-vendor-stub'
  | 'ron-provider-stub'
  | 'eclose-platform-stub'
  | 'adverse-action-notice-stub';

/** Integrations created inactive until an admin enables them (Phase 4–5 stubs). */
export const DATA_FEED_STUBS_OFF_BY_DEFAULT: ReadonlySet<string> = new Set([
  'investor-tpo-connector',
  'hedge-data-vendor',
  'appraisal-amc-stub',
  'flood-cert-vendor-stub',
  'title-vendor-stub',
  'homeowners-insurance-vendor-stub',
  'ron-provider-stub',
  'eclose-platform-stub',
  'adverse-action-notice-stub',
]);

export function isDataFeedStubOffByDefault(providerName: string): boolean {
  return DATA_FEED_STUBS_OFF_BY_DEFAULT.has(providerName);
}
