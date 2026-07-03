# Zoom Integration Guide

## Overview

The Zoom integration enables automatic synchronization of meetings, recordings, and transcripts with the Control Tower platform. This integration uses OAuth 2.0 for secure authentication and provides comprehensive webhook support for real-time updates.

**Provider Type**: Meeting Provider  
**Auth Method**: OAuth 2.0 (Account Credentials Grant)  
**API Version**: v2  
**Status**: ✅ Available

---

## Quick Start Checklist

Before implementing, ensure you have:

- [ ] Zoom Developer account
- [ ] Zoom Pro/Business account (for cloud recordings)
- [ ] Control Tower Supabase project connected
- [ ] The following environment variables ready:
  - `ZOOM_CLIENT_ID`
  - `ZOOM_CLIENT_SECRET`
  - `ZOOM_ACCOUNT_ID`

**Estimated Setup Time**: 20-30 minutes

---

## Environment Variables

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `ZOOM_CLIENT_ID` | Yes | OAuth App Client ID | Zoom App Marketplace > Your App |
| `ZOOM_CLIENT_SECRET` | Yes | OAuth App Client Secret | Zoom App Marketplace > Your App |
| `ZOOM_ACCOUNT_ID` | Yes | Account ID for Server-to-Server | Zoom App Marketplace > Your App |
| `ZOOM_SYNC_USER_ID` | Conditional | Zoom user id or email for `GET /users/{userId}/recordings` | Same as the host user you want to pull recordings for; can live in integration config instead |

### Supabase Secrets Configuration

Add these secrets via **Supabase Dashboard > Project Settings > Edge Functions > Secrets**:

```bash
ZOOM_CLIENT_ID=your-client-id
ZOOM_CLIENT_SECRET=your-client-secret
ZOOM_ACCOUNT_ID=your-account-id
# Optional if sync_user_id is saved in Admin → Integrations → Zoom:
ZOOM_SYNC_USER_ID=user@company.com
```

**Alternative:** store **Client ID**, **Account ID**, **Client Secret**, and **Sync user** in the database via **Admin → Integrations → Meeting providers → Zoom** (`integration_settings` row `provider_name = 'zoom'`). Edge functions read **environment variables first**, then fall back to the saved row. Use one approach or merge both (env overrides missing DB fields).

### Related Edge Functions

| Edge Function | Purpose | Status |
|---------------|---------|--------|
| `sync-zoom-files` | Sync recordings and transcripts | ✅ Available |
| `zoom-transcript-processing` | Process VTT transcripts | Planned / optional |
| `zoom-disconnect` | Clear cached S2S tokens; disable integration row | ✅ Available |
| `generate-meeting-summary` | AI summarization | ✅ Available |
| `auto-embed-meetings` | Generate embeddings for search | ✅ Available |

### Database Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `meetings` | Store meeting metadata | ✅ Available |
| `zoom_files` | Store Zoom recordings/transcripts | ✅ Available |
| `meeting_transcripts` | Store parsed transcript content | ✅ Available |
| `embeddings` | Store vector embeddings | ✅ Available |

### Frontend Hooks

| Hook | Purpose | File |
|------|---------|------|
| `useSyncZoom` | Trigger Zoom file sync | `src/hooks/useSyncZoom.ts` |
| `useZoomFiles` | Fetch/manage Zoom files | `src/hooks/useZoomFiles.ts` |
| `useMeetings` | Fetch/manage meetings | `src/hooks/useMeetings.ts` |

---

## Features

### Available Services

| Service | Description | Status |
|---------|-------------|--------|
| Meeting Sync | Automatically sync meeting metadata | ✅ Available |
| Recording Download | Download and store meeting recordings | ✅ Available |
| Transcript Processing | Process and analyze meeting transcripts | ✅ Available |
| Webhook Events | Real-time meeting event notifications | ✅ Available |
| Cloud Recording | Access cloud recordings | ✅ Available |

### Capabilities

- ✅ List all meetings for a user
- ✅ Get meeting details (participants, duration, etc.)
- ✅ Download cloud recordings (video + audio)
- ✅ Access meeting transcripts
- ✅ Real-time webhooks for meeting events
- ✅ Participant analytics
- ✅ Recording management (list, download, delete)
- ✅ Polling and Q&A data

---

## Setup Instructions

### Step 1: Create Zoom OAuth App

1. Navigate to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** > **Build App**
3. Select **OAuth** app type
4. Fill in basic information:
   - **App Name**: Control Tower Integration
   - **Short Description**: Integration for meeting management
   - **Company Name**: Your company name
   - **Developer Contact**: Your email

### Step 2: Configure OAuth Settings

**OAuth Redirect URLs**:
```
https://your-domain.com/api/oauth-callback
http://localhost:54321/functions/v1/oauth-callback (for development)
```

**OAuth Scopes Required**:
- `user:read` - Read user information
- `meeting:read` - Read meeting information
- `meeting:write` - Create/update meetings
- `recording:read` - Read recording information
- `recording:write` - Manage recordings
- `webinar:read` - Read webinar information (optional)

**OAuth Allow lists** (Optional):
- Add specific domains if needed

### Step 3: Get Credentials

After creating the app, you'll receive:
- **Client ID**: `YOUR_CLIENT_ID`
- **Client Secret**: `YOUR_CLIENT_SECRET`
- **Account ID**: `YOUR_ACCOUNT_ID`

**Important**: Keep these credentials secure and never commit them to version control.

### Step 4: Configure in Control Tower (Server-to-Server)

This product uses **Server-to-Server OAuth** (account credentials), not a per-user browser redirect.

1. Navigate to **Admin** > **Integrations** and open the **Meeting providers** tab.
2. In the **Zoom** card, enter **Client ID**, **Account ID**, **Client Secret**, and **Sync user** (Zoom user id or email whose cloud recordings you want to list).
3. Click **Save configuration**, then **Test connection** (validates token + `GET /users` with your app scopes).
4. Enable the integration toggle, then **Sync now** (admins only). Recordings from roughly the last 30 days upsert into `zoom_files` and link to `meetings` when `zoom_meeting_id` or `zoom_uuid` matches.
5. Optionally use **Disconnect** to clear cached access tokens and disable the row; **Remove** deletes stored credentials entirely.

**System Settings:** the **Zoom meeting sync** toggle (when present) gates the **Sync now** action in the UI. The edge function requires an **admin** JWT and an **active** Zoom integration row when using database-backed credentials (or env-only credentials without a row).

---

## API Reference

### Base URL
```
https://api.zoom.us/v2
```

### Authentication

Zoom uses OAuth 2.0 Bearer tokens for API authentication.

**Token Endpoint**:
```
POST https://zoom.us/oauth/token
```

**Headers**:
```
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded
```

**Body** (for account credentials grant):
```
grant_type=account_credentials&account_id={accountId}
```

**Response**:
```json
{
  "access_token": "eyJh...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "user:read meeting:read recording:read"
}
```

### Key API Endpoints

#### 1. Get Current User
```http
GET /users/me
```

**Response**:
```json
{
  "id": "abc123",
  "email": "user@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "account_id": "xyz789",
  "type": 2,
  "status": "active"
}
```

#### 2. List Meetings
```http
GET /users/{userId}/meetings?type=scheduled&page_size=30
```

**Query Parameters**:
- `type`: `scheduled` | `live` | `upcoming`
- `page_size`: Number of records (max 300)
- `page_number`: Page number

**Response**:
```json
{
  "page_count": 1,
  "page_number": 1,
  "page_size": 30,
  "total_records": 5,
  "meetings": [
    {
      "uuid": "abc123",
      "id": 123456789,
      "host_id": "xyz789",
      "topic": "Team Standup",
      "type": 2,
      "start_time": "2026-01-03T10:00:00Z",
      "duration": 60,
      "timezone": "America/Los_Angeles",
      "agenda": "Daily standup meeting",
      "created_at": "2026-01-02T15:30:00Z",
      "join_url": "https://zoom.us/j/123456789"
    }
  ]
}
```

#### 3. Get Meeting Details
```http
GET /meetings/{meetingId}
```

**Response**:
```json
{
  "uuid": "abc123",
  "id": 123456789,
  "host_id": "xyz789",
  "topic": "Team Standup",
  "type": 2,
  "start_time": "2026-01-03T10:00:00Z",
  "duration": 60,
  "timezone": "America/Los_Angeles",
  "agenda": "Daily standup meeting",
  "created_at": "2026-01-02T15:30:00Z",
  "start_url": "https://zoom.us/s/123456789",
  "join_url": "https://zoom.us/j/123456789",
  "password": "pass123",
  "h323_password": "123456",
  "pstn_password": "123456",
  "encrypted_password": "...",
  "settings": {
    "host_video": true,
    "participant_video": true,
    "cn_meeting": false,
    "in_meeting": false,
    "join_before_host": false,
    "mute_upon_entry": false,
    "watermark": false,
    "use_pmi": false,
    "approval_type": 2,
    "audio": "both",
    "auto_recording": "cloud",
    "alternative_hosts": "",
    "close_registration": false,
    "waiting_room": true,
    "registrants_email_notification": true
  }
}
```

#### 4. List Cloud Recordings
```http
GET /users/{userId}/recordings?from=2026-01-01&to=2026-01-31
```

**Query Parameters**:
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)
- `page_size`: Number of records
- `page_number`: Page number

**Response**:
```json
{
  "from": "2026-01-01",
  "to": "2026-01-31",
  "page_count": 1,
  "page_size": 30,
  "total_records": 3,
  "meetings": [
    {
      "uuid": "abc123",
      "id": 123456789,
      "account_id": "xyz789",
      "host_id": "user123",
      "topic": "Team Standup",
      "start_time": "2026-01-03T10:00:00Z",
      "duration": 45,
      "total_size": 125000000,
      "recording_count": 2,
      "recording_files": [
        {
          "id": "file123",
          "meeting_id": "123456789",
          "recording_start": "2026-01-03T10:00:00Z",
          "recording_end": "2026-01-03T10:45:00Z",
          "file_type": "MP4",
          "file_size": 100000000,
          "play_url": "https://zoom.us/rec/play/...",
          "download_url": "https://zoom.us/rec/download/...",
          "status": "completed",
          "recording_type": "shared_screen_with_speaker_view"
        },
        {
          "id": "file456",
          "meeting_id": "123456789",
          "recording_start": "2026-01-03T10:00:00Z",
          "recording_end": "2026-01-03T10:45:00Z",
          "file_type": "TRANSCRIPT",
          "file_size": 25000,
          "download_url": "https://zoom.us/rec/download/...",
          "status": "completed",
          "recording_type": "audio_transcript"
        }
      ]
    }
  ]
}
```

#### 5. Download Recording
```http
GET {download_url}?access_token={access_token}
```

**Note**: The `download_url` from the recordings API already includes authentication. Stream the response to save the file.

---

## Webhook Configuration

### Event Types

Zoom supports the following webhook events:

| Event | Description | Payload |
|-------|-------------|---------|
| `meeting.started` | Meeting has started | Meeting object |
| `meeting.ended` | Meeting has ended | Meeting object + duration |
| `meeting.participant_joined` | Participant joined | Participant object |
| `meeting.participant_left` | Participant left | Participant object |
| `recording.completed` | Recording is ready | Recording object + download URLs |
| `recording.transcript_completed` | Transcript is ready | Transcript object + download URL |

### Setup Webhooks

1. In your Zoom App configuration, go to **Features** > **Event Subscriptions**
2. Enable **Event Subscriptions**
3. Set **Event notification endpoint URL**:
   ```
   https://your-domain.com/api/webhooks/zoom
   ```
4. Select events to subscribe to:
   - `meeting.started`
   - `meeting.ended`
   - `recording.completed`
   - `recording.transcript_completed`

### Webhook Payload Example

```json
{
  "event": "recording.completed",
  "event_ts": 1641000000000,
  "payload": {
    "account_id": "xyz789",
    "object": {
      "uuid": "abc123",
      "id": 123456789,
      "host_id": "user123",
      "topic": "Team Standup",
      "start_time": "2026-01-03T10:00:00Z",
      "duration": 45,
      "total_size": 125000000,
      "recording_count": 2,
      "recording_files": [
        {
          "id": "file123",
          "recording_start": "2026-01-03T10:00:00Z",
          "recording_end": "2026-01-03T10:45:00Z",
          "file_type": "MP4",
          "file_size": 100000000,
          "download_url": "https://zoom.us/rec/download/...",
          "status": "completed"
        }
      ]
    }
  }
}
```

### Webhook Verification

Zoom signs webhooks with a secret token for verification:

```typescript
import crypto from 'crypto';

function verifyZoomWebhook(
  payload: string,
  timestamp: string,
  signature: string,
  secretToken: string
): boolean {
  const message = `v0:${timestamp}:${payload}`;
  const hashForVerify = crypto
    .createHmac('sha256', secretToken)
    .update(message)
    .digest('hex');
  const expectedSignature = `v0=${hashForVerify}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Integration Services Configuration

### Service 1: Meeting Synchronization

**Configuration Options**:
```typescript
{
  enabled: boolean;
  sync_frequency: '5min' | '15min' | '30min' | '1hour';
  sync_type: 'scheduled' | 'live' | 'upcoming' | 'all';
  auto_create_calendar_events: boolean;
  include_participants: boolean;
}
```

**Sync Logic**:
1. Fetch meetings from Zoom API
2. Compare with existing meetings in database
3. Create/update meeting records
4. Optionally create calendar events
5. Log sync activity

### Service 2: Recording Downloads

**Configuration Options**:
```typescript
{
  enabled: boolean;
  auto_download: boolean;
  storage_location: 'database' | 's3' | 'google_drive';
  retention_days: number;
  file_types: ('MP4' | 'M4A' | 'TRANSCRIPT' | 'CHAT')[];
  max_file_size_mb: number;
}
```

**Download Logic**:
1. Listen for `recording.completed` webhook
2. Fetch recording details from API
3. Download recording files
4. Store according to `storage_location`
5. Create database record with metadata
6. Log download activity

### Service 3: Transcript Processing

**Configuration Options**:
```typescript
{
  enabled: boolean;
  ai_summarization: boolean;
  ai_provider: 'openai' | 'anthropic' | 'google';
  speaker_identification: boolean;
  sentiment_analysis: boolean;
  action_item_extraction: boolean;
}
```

**Processing Logic**:
1. Receive transcript from webhook or download
2. Parse VTT/SRT format
3. If AI summarization enabled:
   - Send to AI provider
   - Generate summary
   - Extract action items
   - Perform sentiment analysis
4. Store processed data
5. Link to meeting record

### Service 4: Webhook Handler

**Configuration Options**:
```typescript
{
  enabled: boolean;
  events: ('meeting.started' | 'meeting.ended' | 'recording.completed' | 'recording.transcript_completed')[];
  notification_channels: ('email' | 'webhook')[];
  webhook_url?: string;
}
```

---

## Database Schema

### Table: `zoom_meetings`

```sql
CREATE TABLE public.zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id BIGINT NOT NULL UNIQUE,
  zoom_uuid TEXT NOT NULL,
  host_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  meeting_type INTEGER,
  start_time TIMESTAMPTZ,
  duration INTEGER,
  timezone TEXT,
  agenda TEXT,
  join_url TEXT,
  password TEXT,
  settings JSONB,
  participants JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_zoom_meetings_zoom_id ON public.zoom_meetings(zoom_meeting_id);
CREATE INDEX idx_zoom_meetings_host ON public.zoom_meetings(host_id);
CREATE INDEX idx_zoom_meetings_start_time ON public.zoom_meetings(start_time);
```

### Table: `zoom_recordings`

```sql
CREATE TABLE public.zoom_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.zoom_meetings(id) ON DELETE CASCADE,
  zoom_recording_id TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  download_url TEXT,
  play_url TEXT,
  recording_start TIMESTAMPTZ,
  recording_end TIMESTAMPTZ,
  status TEXT,
  local_path TEXT,
  storage_location TEXT,
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_zoom_recordings_meeting ON public.zoom_recordings(meeting_id);
CREATE INDEX idx_zoom_recordings_type ON public.zoom_recordings(file_type);
```

### Table: `zoom_transcripts`

```sql
CREATE TABLE public.zoom_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.zoom_meetings(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES public.zoom_recordings(id) ON DELETE SET NULL,
  transcript_text TEXT,
  vtt_content TEXT,
  summary TEXT,
  action_items JSONB,
  sentiment_score DECIMAL(3, 2),
  speakers JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_zoom_transcripts_meeting ON public.zoom_transcripts(meeting_id);
```

---

## Edge Function Implementation

### `sync-zoom-meetings/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ZOOM_API_BASE = 'https://api.zoom.us/v2';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Zoom access token from organization_integrations
    const { data: integration } = await supabase
      .from('organization_integrations')
      .select('oauth_tokens')
      .eq('provider_id', 'zoom-provider-id')
      .single();

    if (!integration?.oauth_tokens?.access_token) {
      throw new Error('Zoom not connected');
    }

    const accessToken = integration.oauth_tokens.access_token;

    // Get current user
    const userResponse = await fetch(`${ZOOM_API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Zoom user');
    }

    const user = await userResponse.json();

    // Fetch meetings
    const meetingsResponse = await fetch(
      `${ZOOM_API_BASE}/users/${user.id}/meetings?type=scheduled&page_size=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!meetingsResponse.ok) {
      throw new Error('Failed to fetch meetings');
    }

    const meetingsData = await meetingsResponse.json();

    // Upsert meetings to database
    const meetings = meetingsData.meetings.map((meeting: any) => ({
      zoom_meeting_id: meeting.id,
      zoom_uuid: meeting.uuid,
      host_id: meeting.host_id,
      topic: meeting.topic,
      meeting_type: meeting.type,
      start_time: meeting.start_time,
      duration: meeting.duration,
      timezone: meeting.timezone,
      agenda: meeting.agenda,
      join_url: meeting.join_url,
      password: meeting.password,
      settings: meeting.settings,
      synced_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('zoom_meetings')
      .upsert(meetings, { onConflict: 'zoom_meeting_id' });

    if (upsertError) {
      throw upsertError;
    }

    // Log usage
    await supabase
      .from('integration_usage_logs')
      .insert({
        provider_id: 'zoom-provider-id',
        action: 'sync_meetings',
        status: 'success',
        request_metadata: { count: meetings.length },
      });

    return new Response(
      JSON.stringify({
        success: true,
        synced: meetings.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Testing Checklist

### OAuth Flow
- [ ] Authorization URL redirects correctly
- [ ] User can sign in to Zoom
- [ ] Permissions screen displays
- [ ] Callback receives authorization code
- [ ] Tokens are exchanged successfully
- [ ] Tokens are stored securely
- [ ] Connection status updates to "connected"

### API Calls
- [ ] Can fetch current user
- [ ] Can list meetings
- [ ] Can get meeting details
- [ ] Can list recordings
- [ ] Can download recordings
- [ ] Rate limits are handled
- [ ] Token refresh works

### Webhooks
- [ ] Webhook endpoint is reachable
- [ ] Signature verification works
- [ ] Events are processed correctly
- [ ] Database updates occur
- [ ] Notifications are sent

### Services
- [ ] Meeting sync runs on schedule
- [ ] Recordings download automatically
- [ ] Transcripts are processed
- [ ] AI summarization works
- [ ] Storage locations are correct

---

## Troubleshooting

### Issue: OAuth fails with "invalid_client"

**Solution**: Verify Client ID and Client Secret are correct in integration configuration.

### Issue: API returns 401 Unauthorized

**Solution**: Access token may have expired. Implement token refresh logic.

### Issue: Recordings not downloading

**Solution**:
1. Check `recording.completed` webhook is configured
2. Verify download URL is valid
3. Check file size limits
4. Ensure storage location has sufficient space

### Issue: Webhooks not received

**Solution**:
1. Verify webhook URL is publicly accessible
2. Check Zoom app has webhooks enabled
3. Verify signature verification is correct
4. Check webhook logs in Zoom dashboard

---

## Rate Limits

Zoom API rate limits:
- **Light**: 100 requests/day (free apps)
- **Medium**: 1,000 requests/day (OAuth apps)
- **Heavy**: 10,000 requests/day (approved apps)

**Per-endpoint limits**:
- Most endpoints: 5 requests/second per access token
- Meetings list: 10 requests/minute
- Recordings list: 10 requests/minute

**Best Practices**:
- Implement exponential backoff
- Cache responses when possible
- Use webhooks instead of polling
- Batch operations where supported

---

## Security Considerations

1. **Never expose access tokens** in client-side code
2. **Store tokens encrypted** in database
3. **Implement token rotation** (refresh before expiry)
4. **Validate webhook signatures** to prevent spoofing
5. **Use HTTPS** for all API calls and webhook endpoints
6. **Limit OAuth scopes** to only what's needed
7. **Implement proper RLS** on database tables
8. **Log all API calls** for audit purposes

---

## Resources

- [Zoom API Documentation](https://marketplace.zoom.us/docs/api-reference/introduction)
- [OAuth Guide](https://marketplace.zoom.us/docs/guides/auth/oauth)
- [Webhooks Guide](https://marketplace.zoom.us/docs/api-reference/webhook-reference)
- [Recording Management](https://marketplace.zoom.us/docs/api-reference/zoom-api/methods#tag/Cloud-Recording)
- [Zoom App Marketplace](https://marketplace.zoom.us/)

---

## Support

For issues with the Zoom integration:
1. Check this documentation
2. Review Zoom API logs in dashboard
3. Contact your system administrator
4. Submit a support ticket

**Last Updated**: January 2, 2026
