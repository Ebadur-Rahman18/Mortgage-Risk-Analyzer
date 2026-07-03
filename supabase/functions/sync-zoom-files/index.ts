/**
 * Sync Zoom cloud recordings into public.zoom_files (Server-to-Server OAuth).
 * Requires: admin JWT, integration zoom is_active, credentials, sync_user_id in config or ZOOM_SYNC_USER_ID env.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZoomAccessTokenForSync } from '../_shared/zoom-s2s.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ZOOM_API = 'https://api.zoom.us/v2';

async function requireAdmin(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; message: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing or invalid Authorization header' };
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (roleRow?.role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden: admin role required' };
  }
  return { ok: true, userId: user.id };
}

interface RecordingFile {
  id?: string;
  meeting_id?: string;
  recording_start?: string;
  recording_end?: string;
  file_type?: string;
  file_extension?: string;
  file_size?: number;
  download_url?: string;
  status?: string;
}

interface RecordingMeeting {
  uuid?: string;
  id?: number | string;
  topic?: string;
  start_time?: string;
  duration?: number;
  recording_files?: RecordingFile[];
}

interface ListRecordingsResponse {
  meetings?: RecordingMeeting[];
  next_page_token?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const adminCheck = await requireAdmin(req.headers.get('Authorization'), supabaseUrl, anonKey, serviceKey);
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: adminCheck.message }), {
        status: adminCheck.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      meeting_id?: string;
      force_refresh?: boolean;
      sync_recordings?: boolean;
      sync_transcripts?: boolean;
      from?: string;
      to?: string;
    };

    const { data: setting, error: setErr } = await supabase
      .from('integration_settings')
      .select('id, config, is_active')
      .eq('provider_name', 'zoom')
      .maybeSingle();

    const config = (setting?.config ?? {}) as Record<string, unknown>;
    const envOnly = !setting?.id;
    if (!envOnly && (!setting || setErr || !setting.is_active)) {
      return new Response(
        JSON.stringify({ error: 'Zoom integration is disabled or not configured. Enable it in Admin → Integrations.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const syncUserId =
      (typeof config.sync_user_id === 'string' && config.sync_user_id.trim()) ||
      Deno.env.get('ZOOM_SYNC_USER_ID')?.trim() ||
      '';
    if (!syncUserId) {
      return new Response(
        JSON.stringify({
          error:
            'Set Zoom sync user: add sync_user_id (Zoom user id or email) in integration config via Admin, or set ZOOM_SYNC_USER_ID secret.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenRes = await getZoomAccessTokenForSync(supabase, setting?.id ?? null, config);
    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: tokenRes.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const accessToken = tokenRes.access_token;

    const to = body.to || new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const from = body.from || fromDate.toISOString().split('T')[0];

    let nextPageToken: string | undefined;
    let upserted = 0;
    const errors: string[] = [];

    let meetingRow: { id: string; zoom_meeting_id: string | null; zoom_uuid: string | null } | null =
      null;
    if (body.meeting_id) {
      const { data: mr, error: mrErr } = await supabase
        .from('meetings')
        .select('id, zoom_meeting_id, zoom_uuid')
        .eq('id', body.meeting_id)
        .maybeSingle();
      if (mrErr || !mr) {
        return new Response(JSON.stringify({ error: 'Meeting not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      meetingRow = mr;
    }

    const targetZoomMeetingId = meetingRow?.zoom_meeting_id
      ? String(meetingRow.zoom_meeting_id)
      : null;
    const targetZoomUuid = meetingRow?.zoom_uuid || null;

    do {
      const params = new URLSearchParams({
        from,
        to,
        page_size: '30',
      });
      if (nextPageToken) params.set('next_page_token', nextPageToken);
      if (body.meeting_id && targetZoomMeetingId) {
        params.set('meeting_id', targetZoomMeetingId);
      }

      const url = `${ZOOM_API}/users/${encodeURIComponent(syncUserId)}/recordings?${params}`;
      const zres = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!zres.ok) {
        const t = await zres.text();
        console.error('Zoom recordings list error:', zres.status, t);
        return new Response(
          JSON.stringify({
            error: 'Failed to list Zoom recordings. Check sync user id and app scopes (e.g. cloud_recording:read:list_user_recordings).',
            detail: t.slice(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const data = (await zres.json()) as ListRecordingsResponse;
      nextPageToken = data.next_page_token;

      const meetings = data.meetings || [];
      for (const m of meetings) {
        const uuid = m.uuid || '';
        const numericId = m.id != null ? String(m.id) : '';
        if (!uuid) continue;

        if (
          body.meeting_id &&
          targetZoomUuid &&
          uuid !== targetZoomUuid &&
          targetZoomMeetingId &&
          numericId !== targetZoomMeetingId
        ) {
          continue;
        }

        let linkedMeetingId: string | null = null;
        if (body.meeting_id && meetingRow?.id) {
          linkedMeetingId = meetingRow.id;
        } else {
          let q = supabase.from('meetings').select('id').limit(1);
          if (numericId) {
            q = q.or(`zoom_uuid.eq.${uuid},zoom_meeting_id.eq.${numericId}`);
          } else {
            q = q.eq('zoom_uuid', uuid);
          }
          const { data: matchRows } = await q;
          if (matchRows && matchRows.length > 0) {
            linkedMeetingId = matchRows[0].id;
          }
        }

        const files = m.recording_files || [];
        for (const f of files) {
          const fileId = f.id != null ? String(f.id) : '';
          if (!fileId) continue;

          const fileType = f.file_type || f.file_extension || 'UNKNOWN';
          const fileName = `${m.topic || 'recording'}_${fileType}.${(f.file_extension || 'bin').replace(/^\./, '')}`;

          const row = {
            meeting_id: linkedMeetingId,
            zoom_meeting_uuid: uuid,
            zoom_recording_file_id: fileId,
            zoom_meeting_id: numericId || null,
            file_type: fileType,
            file_name: fileName.slice(0, 500),
            file_size: f.file_size ?? null,
            file_path: null as string | null,
            storage_path: null as string | null,
            download_url: f.download_url || null,
            transcript_text: null as string | null,
            transcript_content: null as unknown,
            is_processed: false,
            has_embeddings: false,
            processing_status: 'pending',
            metadata: {
              topic: m.topic,
              start_time: m.start_time,
              duration: m.duration,
              recording_start: f.recording_start,
              recording_end: f.recording_end,
              status: f.status,
            } as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          };

          const { error: upErr } = await supabase.from('zoom_files').upsert(row, {
            onConflict: 'zoom_meeting_uuid,zoom_recording_file_id',
            ignoreDuplicates: false,
          });
          if (upErr) {
            errors.push(`${fileId}: ${upErr.message}`);
          } else {
            upserted++;
          }
        }
      }
    } while (nextPageToken);

    const message =
      errors.length > 0
        ? `Synced ${upserted} file(s) with ${errors.length} error(s).`
        : `Synced ${upserted} Zoom recording file(s).`;

    return new Response(
      JSON.stringify({
        success: true,
        message,
        upserted,
        errors: errors.slice(0, 20),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
