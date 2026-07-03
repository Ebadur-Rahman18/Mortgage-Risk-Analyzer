/**
 * approve-borrower-communication — lifecycle transitions with JWT + RLS.
 * Actions: approve | reject | needs_revision | mark_sent
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchNotification } from '../_shared/dispatch-notification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action = 'approve' | 'reject' | 'needs_revision' | 'mark_sent';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      communication_id?: string;
      action?: Action;
      draft_content?: string;
    };

    const communication_id = body.communication_id;
    const action = body.action;
    if (!communication_id || !action) {
      return new Response(
        JSON.stringify({ error: 'communication_id and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const valid: Action[] = ['approve', 'reject', 'needs_revision', 'mark_sent'];
    if (!valid.includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: row, error: fetchErr } = await userClient
      .from('borrower_communications')
      .select('id, status, loan_id, created_by_user_id, doc_type')
      .eq('id', communication_id)
      .maybeSingle();

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: 'Not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const uid = userData.user.id;

    type Patch = Record<string, unknown>;
    let patch: Patch = {};

    if (action === 'approve') {
      if (row.status !== 'draft' && row.status !== 'needs_revision') {
        return new Response(
          JSON.stringify({ error: `Cannot approve from status ${row.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      patch = {
        status: 'approved',
        approved_by: uid,
        approved_at: now,
        rejected_at: null,
      };
      if (typeof body.draft_content === 'string' && body.draft_content.length > 0) {
        patch.draft_content = body.draft_content;
      }
    } else if (action === 'reject') {
      if (row.status !== 'draft' && row.status !== 'needs_revision' && row.status !== 'approved') {
        return new Response(
          JSON.stringify({ error: `Cannot reject from status ${row.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      patch = { status: 'rejected', rejected_at: now };
    } else if (action === 'needs_revision') {
      if (row.status !== 'draft' && row.status !== 'approved') {
        return new Response(
          JSON.stringify({ error: `Cannot mark needs_revision from status ${row.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      patch = { status: 'needs_revision', approved_at: null, approved_by: null };
      if (typeof body.draft_content === 'string' && body.draft_content.length > 0) {
        patch.draft_content = body.draft_content;
      }
    } else if (action === 'mark_sent') {
      if (row.status !== 'approved') {
        return new Response(
          JSON.stringify({ error: 'Only approved drafts can be marked sent' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      patch = { status: 'sent', sent_at: now };
      if (typeof body.draft_content === 'string' && body.draft_content.length > 0) {
        patch.draft_content = body.draft_content;
      }
    }

    const { data: updated, error: updateErr } = await userClient
      .from('borrower_communications')
      .update(patch)
      .eq('id', communication_id)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error(updateErr);
      return new Response(
        JSON.stringify({ error: 'Update failed', details: updateErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const creatorId = row.created_by_user_id as string;
    if (creatorId && creatorId !== uid) {
      const labels: Record<string, string> = {
        approve: 'approved',
        reject: 'rejected',
        needs_revision: 'marked as needing revision',
        mark_sent: 'marked sent',
      };
      const service = createClient(supabaseUrl, serviceKey);
      try {
        await dispatchNotification(service, {
          user_id: creatorId,
          title: `Communication draft ${labels[action] ?? action}`,
          message: `Your ${row.doc_type} draft was ${labels[action] ?? action} by another team member.`,
          type: 'info',
          link: `/loans/${row.loan_id as string}`,
          metadata: {
            event_type: 'borrower_communication',
            communication_id,
            action,
          },
          channels: ['in_app', 'email'],
          dedupe_key: `bc:${communication_id}:${action}`,
        });
      } catch (e) {
        console.error('dispatchNotification:', e);
      }
    }

    return new Response(JSON.stringify({ communication: updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
