/**
 * HS256 JWT for borrower portal session (not Supabase Auth).
 */
import { SignJWT, jwtVerify } from 'https://esm.sh/jose@5.9.6';

const CLAIM_TYP = 'portal';

export async function signPortalAccessToken(args: {
  secret: string;
  borrowerId: string;
  loanId: string;
  ttlSec: number;
}): Promise<string> {
  const key = new TextEncoder().encode(args.secret);
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    typ: CLAIM_TYP,
    loan_id: args.loanId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(args.borrowerId)
    .setIssuedAt(now)
    .setExpirationTime(now + args.ttlSec)
    .sign(key);
}

export async function verifyPortalAccessToken(
  token: string,
  secret: string,
): Promise<{ loanId: string; borrowerId: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  const rec = payload as Record<string, unknown>;
  if (rec.typ !== CLAIM_TYP) throw new Error('Invalid token type');
  const loanId = rec.loan_id as string | undefined;
  const borrowerId = typeof payload.sub === 'string' ? payload.sub : undefined;
  if (!loanId || !borrowerId) throw new Error('Invalid token claims');
  return { loanId, borrowerId };
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomInviteToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PORTAL_JWT_DERIVE_LABEL = 'borrower-portal-jwt-hs256-v1';

/**
 * Prefer PORTAL_JWT_SECRET when set (rotation / isolation from service role).
 * Otherwise derive a stable HS256 key from SUPABASE_SERVICE_ROLE_KEY so portal
 * flows work without extra Dashboard secrets (same trust boundary as Edge + DB).
 */
export async function resolvePortalJwtSecret(): Promise<string | null> {
  const explicit = Deno.env.get('PORTAL_JWT_SECRET')?.trim();
  if (explicit) return explicit;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!serviceRole) return null;
  return await sha256Hex(`${PORTAL_JWT_DERIVE_LABEL}:${serviceRole}`);
}
