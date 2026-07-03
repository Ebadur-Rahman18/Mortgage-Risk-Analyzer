/**
 * Borrower portal: send a message to the loan officer (portal JWT).
 * Self-contained — all shared code inlined for Supabase Cloud dashboard deployment.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.9.6';

// ── Inlined portal-jwt helpers ──────────────────────────────────────────────

const CLAIM_TYP = 'portal';
const PORTAL_JWT_DERIVE_LABEL = 'borrower-portal-jwt-hs256-v1';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolvePortalJwtSecret(): Promise<string | null> {
  const explicit = Deno.env.get('PORTAL_JWT_SECRET')?.trim();
  if (explicit) return explicit;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!serviceRole) return null;
  return await sha256Hex(`${PORTAL_JWT_DERIVE_LABEL}:${serviceRole}`);
}

async function verifyPortalAccessToken(
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

// ── Inlined dispatch-notification (in_app only) ─────────────────────────────

async function dispatchInAppNotification(
  supabase: SupabaseClient,
  input: {
    user_id: string;
    title: string;
    message: string;
    type?: string;
    link?: string | null;
    metadata?: Record<string, unknown>;
    dedupe_key?: string | null;
  },
): Promise<void> {
  const row = {
    user_id: input.user_id,
    title: input.title,
    message: input.message,
    type: input.type ?? 'info',
    link: input.link ?? null,
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupe_key ?? null,
    is_read: false,
  };
  const { error } = await supabase.from('notifications').insert(row);
  if (error) console.error('Notification insert error:', error.message);
}

// ── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const portalSecret = await resolvePortalJwtSecret();
    if (!supabaseUrl || !serviceKey || !portalSecret) {
      return jsonResp({ error: 'Server misconfiguration' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }

    const portalJwt = authHeader.replace(/^Bearer\s+/i, '');
    let loanId: string;
    let borrowerId: string;
    try {
      ({ loanId, borrowerId } = await verifyPortalAccessToken(portalJwt, portalSecret));
    } catch {
      return jsonResp({ error: 'Invalid or expired session' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as { body?: string };
    const messageBody = (body.body || '').trim();
    if (!messageBody) {
      return jsonResp({ error: 'Message body is required' }, 400);
    }
    if (messageBody.length > 5000) {
      return jsonResp({ error: 'Message too long (max 5000 chars)' }, 400);
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: loan } = await service
      .from('loans')
      .select('id, loan_number, loan_officer_id, borrower_id')
      .eq('id', loanId)
      .maybeSingle();

    if (!loan || loan.borrower_id !== borrowerId) {
      return jsonResp({ error: 'Not found' }, 404);
    }

    const { data: msg, error: insErr } = await service
      .from('portal_messages')
      .insert({
        loan_id: loanId,
        borrower_id: borrowerId,
        sender_type: 'borrower',
        sender_user_id: null,
        body: messageBody,
      })
      .select('id, sender_type, body, is_read, created_at')
      .single();

    if (insErr || !msg) {
      console.error('Insert message error:', insErr);
      return jsonResp({ error: 'Failed to send message' }, 500);
    }

    // Notify loan officer
    if (loan.loan_officer_id) {
      const { data: borrower } = await service
        .from('borrowers')
        .select('first_name, last_name')
        .eq('id', borrowerId)
        .maybeSingle();
      const borrowerName = borrower
        ? [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') || 'Borrower'
        : 'Borrower';

      try {
        await dispatchInAppNotification(service, {
          user_id: loan.loan_officer_id as string,
          title: `New message from ${borrowerName}`,
          message: messageBody.slice(0, 100) + (messageBody.length > 100 ? '…' : ''),
          type: 'info',
          link: `/loans/${loanId}`,
          metadata: {
            event_type: 'portal_message',
            loan_id: loanId,
            message_id: msg.id,
          },
          dedupe_key: `portal_msg:${msg.id}`,
        });
      } catch (e) {
        console.error('Notification error:', e);
      }
    }

    return jsonResp({ message: msg });
  } catch (e) {
    console.error(e);
    return jsonResp({ error: 'Internal error' }, 500);
  }
});
