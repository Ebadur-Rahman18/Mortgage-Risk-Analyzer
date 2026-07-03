/**
 * Parse HubSpot CRM v3 list payloads stored in integration_settings.config
 * (written by sync-data-feed for provider hubspot).
 */

export type HubSpotPipelineContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type HubSpotPipelineDeal = {
  id: string;
  name: string;
  amount: string;
  stage: string;
};

function prop(p: Record<string, string | null | undefined> | undefined, key: string): string {
  if (!p) return '';
  const v = p[key];
  return v == null ? '' : String(v);
}

export function parseHubSpotContactsJson(jsonStr: string | undefined | null): HubSpotPipelineContact[] {
  if (!jsonStr?.trim()) return [];
  try {
    const arr = JSON.parse(jsonStr) as Array<{ id?: string; properties?: Record<string, string | null> }>;
    if (!Array.isArray(arr)) return [];
    return arr.map((r) => {
      const p = r.properties ?? {};
      return {
        id: String(r.id ?? ''),
        firstName: prop(p, 'firstname'),
        lastName: prop(p, 'lastname'),
        email: prop(p, 'email'),
      };
    });
  } catch {
    return [];
  }
}

export function parseHubSpotDealsJson(jsonStr: string | undefined | null): HubSpotPipelineDeal[] {
  if (!jsonStr?.trim()) return [];
  try {
    const arr = JSON.parse(jsonStr) as Array<{ id?: string; properties?: Record<string, string | null> }>;
    if (!Array.isArray(arr)) return [];
    return arr.map((r) => {
      const p = r.properties ?? {};
      return {
        id: String(r.id ?? ''),
        name: prop(p, 'dealname'),
        amount: prop(p, 'amount'),
        stage: prop(p, 'dealstage'),
      };
    });
  } catch {
    return [];
  }
}
