/**
 * Borrower portal edge calls (no Supabase Auth session; uses anon key + portal JWT where needed).
 */
import { getSupabasePublicConfig } from "@/integrations/supabase/public-config";

export const PORTAL_TOKEN_KEY = "mct_portal_access_token";

/**
 * `portal-create-invite` defaults to http://localhost:5173 when BORROWER_PORTAL_APP_URL
 * is unset. If you run Vite on another port (e.g. 8080/8081), copied links would 5173 and
 * fail with ERR_CONNECTION_REFUSED. Rewrite loopback URLs to the tab's actual origin.
 */
export function alignPortalInviteLinkToCurrentHost(inviteLink: string): string {
  if (typeof window === "undefined") return inviteLink;
  try {
    const u = new URL(inviteLink);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* ignore */
  }
  return inviteLink;
}

export function getPortalAccessToken(): string | null {
  try {
    return sessionStorage.getItem(PORTAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPortalAccessToken(token: string): void {
  sessionStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalAccessToken(): void {
  sessionStorage.removeItem(PORTAL_TOKEN_KEY);
}

export type PortalRedeemResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  loan_id: string;
};

const redeemInFlight = new Map<string, Promise<PortalRedeemResponse>>();

async function redeemPortalInviteOnce(
  token: string,
  loan_number?: string,
): Promise<PortalRedeemResponse> {
  const { url, key } = getSupabasePublicConfig();
  const res = await fetch(`${url}/functions/v1/portal-redeem-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ token, loan_number: loan_number?.trim() || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Could not open portal link");
  }
  return data as PortalRedeemResponse;
}

/** Deduplicates concurrent redeem calls (e.g. React Strict Mode double effect). */
export async function redeemPortalInvite(
  token: string,
  loan_number?: string,
): Promise<PortalRedeemResponse> {
  const t = token.trim();
  let p = redeemInFlight.get(t);
  if (!p) {
    p = redeemPortalInviteOnce(t, loan_number).finally(() => {
      redeemInFlight.delete(t);
    });
    redeemInFlight.set(t, p);
  }
  return p;
}

export type PortalMilestone = {
  id: string;
  milestone_type: string;
  name: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

export type PortalMessage = {
  id: string;
  sender_type: "borrower" | "staff";
  sender_user_id: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type PortalDisclosure = {
  id: string;
  disclosure_type: string;
  title: string;
  status: "pending" | "sent" | "viewed" | "signed" | "declined";
  signing_url: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
};

export type PortalLoanSummary = {
  loan: {
    id: string;
    loan_number: string;
    status: string;
    lock_date: string | null;
    lock_expiration_date: string | null;
    property_city: string | null;
    property_state: string | null;
    loan_officer_name: string | null;
  };
  conditions: Array<{
    id: string;
    condition_type: string;
    category: string | null;
    description: string;
    status: string;
    due_date: string | null;
    assigned_party: string | null;
    priority: string | null;
  }>;
  recent_uploads: Array<{
    id: string;
    file_name: string;
    submitted_at: string;
    review_status: string;
    loan_condition_id: string | null;
  }>;
  milestones: PortalMilestone[];
  messages: PortalMessage[];
  disclosures: PortalDisclosure[];
  docusign_enabled: boolean;
};

export async function fetchPortalLoanSummary(portalJwt: string): Promise<PortalLoanSummary> {
  const { url, key } = getSupabasePublicConfig();
  const res = await fetch(`${url}/functions/v1/portal-loan-summary`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${portalJwt}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to load loan summary");
  }
  return data as PortalLoanSummary;
}

export async function submitPortalUpload(
  portalJwt: string,
  file: File,
  loan_condition_id?: string | null,
): Promise<{ id: string; file_name: string; submitted_at: string; review_status: string }> {
  const { url, key } = getSupabasePublicConfig();
  const fd = new FormData();
  fd.append("file", file);
  if (loan_condition_id) {
    fd.append("loan_condition_id", loan_condition_id);
  }
  const res = await fetch(`${url}/functions/v1/portal-submit-upload`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${portalJwt}`,
    },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Upload failed");
  }
  const upload = (data as { upload?: { id: string; file_name: string; submitted_at: string; review_status: string } })
    .upload;
  if (!upload) throw new Error("Invalid upload response");
  return upload;
}

export async function sendPortalMessage(
  portalJwt: string,
  body: string,
): Promise<PortalMessage> {
  const { url, key } = getSupabasePublicConfig();
  const res = await fetch(`${url}/functions/v1/portal-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${portalJwt}`,
    },
    body: JSON.stringify({ body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to send message");
  }
  return (data as { message: PortalMessage }).message;
}
