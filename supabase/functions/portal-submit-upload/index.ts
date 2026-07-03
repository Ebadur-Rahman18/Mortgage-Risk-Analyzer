/**
 * Borrower portal: multipart file upload (portal JWT).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolvePortalJwtSecret, verifyPortalAccessToken } from '../_shared/portal-jwt.ts';
import { dispatchNotification } from '../_shared/dispatch-notification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 26_214_400; // 25 MiB (matches bucket limit)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const portalSecret = await resolvePortalJwtSecret();
    if (!supabaseUrl || !serviceKey || !portalSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const portalJwt = authHeader.replace(/^Bearer\s+/i, '');
    let loanId: string;
    let borrowerId: string;
    try {
      ({ loanId, borrowerId } = await verifyPortalAccessToken(portalJwt, portalSecret));
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const form = await req.formData();
    const file = form.get('file');
    const conditionRaw = form.get('loan_condition_id');
    const loan_condition_id =
      typeof conditionRaw === 'string' && conditionRaw.length > 0 ? conditionRaw : null;

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'file is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'File too large (max 25 MB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED.has(mime)) {
      return new Response(
        JSON.stringify({ error: 'File type not allowed. Use PDF, JPEG, PNG, or WebP.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const service = createClient(supabaseUrl, serviceKey);

    const { data: loan, error: loanErr } = await service
      .from('loans')
      .select('id, borrower_id, loan_officer_id')
      .eq('id', loanId)
      .maybeSingle();

    if (loanErr || !loan || loan.borrower_id !== borrowerId) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (loan_condition_id) {
      const { data: cond } = await service
        .from('loan_conditions')
        .select('id')
        .eq('id', loan_condition_id)
        .eq('loan_id', loanId)
        .maybeSingle();
      if (!cond) {
        return new Response(JSON.stringify({ error: 'Invalid condition for this loan' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const uploadId = crypto.randomUUID();
    const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 180) || 'upload';
    const storage_path = `${loanId}/${uploadId}/${safeName}`;

    const buf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await service.storage.from('loan-borrower-uploads').upload(storage_path, buf, {
      contentType: mime,
      upsert: false,
    });

    if (upErr) {
      console.error(upErr);
      return new Response(JSON.stringify({ error: 'Upload failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: row, error: insErr } = await service
      .from('loan_borrower_uploads')
      .insert({
        id: uploadId,
        loan_id: loanId,
        borrower_id: borrowerId,
        loan_condition_id,
        storage_path,
        file_name: file.name.slice(0, 500),
        mime_type: mime,
        byte_size: file.size,
        source: 'portal',
      })
      .select('id, file_name, submitted_at, review_status')
      .single();

    if (insErr || !row) {
      console.error(insErr);
      await service.storage.from('loan-borrower-uploads').remove([storage_path]);
      return new Response(JSON.stringify({ error: 'Failed to save upload record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const forwarded = req.headers.get('x-forwarded-for') ?? '';
    const ip = forwarded.split(',')[0]?.trim() || 'unknown';
    await service.from('borrower_portal_audit').insert({
      event_type: 'upload_submitted',
      loan_id: loanId,
      borrower_id: borrowerId,
      upload_id: uploadId,
      ip,
      user_agent: req.headers.get('user-agent') ?? '',
      metadata: { file_name: file.name, loan_condition_id },
    });

    // Auto-mark linked condition as "received" when borrower uploads a document
    if (loan_condition_id) {
      const { error: condUpdateErr } = await service
        .from('loan_conditions')
        .update({
          status: 'received',
          received_at: new Date().toISOString(),
        })
        .eq('id', loan_condition_id)
        .eq('loan_id', loanId)
        .in('status', ['pending']);
      if (condUpdateErr) {
        console.error('Auto-receive condition error:', condUpdateErr);
      }
    }

    // Load condition description for richer notification
    let conditionDesc = '';
    if (loan_condition_id) {
      const { data: condRow } = await service
        .from('loan_conditions')
        .select('condition_type, description')
        .eq('id', loan_condition_id)
        .maybeSingle();
      if (condRow) {
        conditionDesc = ` for ${condRow.condition_type}: ${(condRow.description || '').slice(0, 60)}`;
      }
    }

    // Notify loan officer (action item)
    if (loan.loan_officer_id) {
      await service.from('action_items').insert({
        title: loan_condition_id
          ? `Borrower uploaded document${conditionDesc} — condition auto-received`
          : 'Borrower uploaded a document (portal)',
        description: `File: ${file.name}. Review in loan ${loanId.slice(0, 8)}…`,
        assigned_to_user_id: loan.loan_officer_id,
        loan_id: loanId,
        source: 'document',
        priority: 'normal',
        status: 'pending',
        metadata: { upload_id: uploadId, source_detail: 'borrower_portal' },
      });
      try {
        await dispatchNotification(service, {
          user_id: loan.loan_officer_id as string,
          title: loan_condition_id
            ? `Borrower fulfilled a condition${conditionDesc}`
            : 'Borrower uploaded a document',
          message: loan_condition_id
            ? `${file.name} — condition auto-marked as received`
            : `${file.name} (borrower portal)`,
          type: 'info',
          link: `/loans/${loanId}`,
          metadata: {
            event_type: 'borrower_portal_upload',
            upload_id: uploadId,
            loan_id: loanId,
          },
          channels: ['in_app', 'email'],
          dedupe_key: `portal_upload:${uploadId}`,
        });
      } catch (e) {
        console.error('dispatchNotification portal upload:', e);
      }
    }

    return new Response(JSON.stringify({ upload: row }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
