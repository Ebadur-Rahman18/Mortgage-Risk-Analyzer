# Google Meet Integration

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![API](https://img.shields.io/badge/API-Meet%20REST%20v2-blue)

## Overview

Create and manage Google Meet video conferences, with optional recording and transcript access.

**Current Status**: Not implemented. Planned for future release.

---

## Quick Start Checklist

- [ ] Google Cloud Console access
- [ ] Google Meet REST API enabled
- [ ] OAuth 2.0 credentials configured
- [ ] Workspace edition with Meet recording (optional)
- [ ] Environment variables configured

**Estimated Setup Time**: 30-40 minutes

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret |

---

## Planned Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Create Meeting | Generate Meet links | High |
| Get Meeting Info | Retrieve meeting details | High |
| List Recordings | Access cloud recordings | Medium |
| Get Transcripts | Download meeting transcripts | Medium |
| Conference Events | Real-time participant events | Low |

---

## Setup Instructions

### Step 1: Enable Google Meet REST API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Library**
3. Search for "Google Meet REST API"
4. Click **Enable**

> **Note**: The Meet REST API is different from generating Meet links via Calendar API.

### Step 2: Configure OAuth Scopes

```
# Create and manage meetings
https://www.googleapis.com/auth/meetings.space.created

# Read-only access
https://www.googleapis.com/auth/meetings.space.readonly
```

---

## API Reference

**Base URL**: `https://meet.googleapis.com/v2`

### Create Meeting Space

```http
POST /spaces
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "config": {
    "accessType": "TRUSTED",
    "entryPointAccess": "ALL"
  }
}
```

**Response:**
```json
{
  "name": "spaces/abc-defg-hij",
  "meetingUri": "https://meet.google.com/abc-defg-hij",
  "meetingCode": "abc-defg-hij",
  "config": {
    "accessType": "TRUSTED",
    "entryPointAccess": "ALL"
  }
}
```

### Get Meeting Space

```http
GET /spaces/{space_id}
Authorization: Bearer {access_token}
```

### End Active Call

```http
POST /spaces/{space_id}/activeConference:end
Authorization: Bearer {access_token}
```

### List Recordings

```http
GET /conferenceRecords/{conference_id}/recordings
Authorization: Bearer {access_token}
```

### Get Transcript

```http
GET /conferenceRecords/{conference_id}/transcripts/{transcript_id}
Authorization: Bearer {access_token}
```

---

## Creating Meet Links via Calendar API

For simpler use cases, Meet links can be created via the Calendar API:

```http
POST /calendars/primary/events?conferenceDataVersion=1
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "summary": "Quick Meeting",
  "start": {"dateTime": "2025-01-05T10:00:00Z"},
  "end": {"dateTime": "2025-01-05T11:00:00Z"},
  "conferenceData": {
    "createRequest": {
      "requestId": "unique-request-id",
      "conferenceSolutionKey": {"type": "hangoutsMeet"}
    }
  }
}
```

---

## Planned Edge Functions

### `google-meet-create` (To Be Created)

**Purpose**: Create Google Meet conferences

**Planned Features**:
- Generate Meet links
- Configure access settings
- Return join URLs

### `google-meet-recordings` (To Be Created)

**Purpose**: Sync Meet recordings to Control Tower

**Planned Features**:
- List available recordings
- Download video/audio files
- Extract transcripts

---

## Requirements

### For Basic Meet Links
- Any Google account
- Calendar API access

### For Recordings & Transcripts
- Google Workspace Business Standard or higher
- Meet recording enabled by admin
- Cloud recording turned on during meeting

---

## Rate Limits

| Quota | Limit |
|-------|-------|
| Queries per day | 25,000 |
| Queries per minute per user | 60 |

---

## Resources

- [Google Meet REST API Documentation](https://developers.google.com/meet/api)
- [Meet API Reference](https://developers.google.com/meet/api/reference/rest)
- [Calendar API - Conference Data](https://developers.google.com/calendar/api/guides/create-events#conferencing)

---

**Last Updated**: January 5, 2026
