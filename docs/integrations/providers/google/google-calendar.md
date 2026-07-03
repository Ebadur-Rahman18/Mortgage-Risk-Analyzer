# Google Calendar Integration

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![API](https://img.shields.io/badge/API-Calendar%20v3-blue)

## Overview

Sync calendar events from Google Calendar to Control Tower for meeting management and scheduling insights.

**Current Status**: Not implemented. Planned for future release.

---

## Quick Start Checklist

- [ ] Google Cloud Console access
- [ ] Google Calendar API enabled
- [ ] OAuth 2.0 credentials configured
- [ ] OAuth consent screen with calendar scopes
- [ ] Environment variables configured

**Estimated Setup Time**: 25-35 minutes

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
| Event Sync | Sync calendar events to meetings table | High |
| Event Creation | Create events from Control Tower | Medium |
| Availability Check | Check free/busy status | Medium |
| Recurring Events | Handle recurring event series | Low |

---

## Setup Instructions

### Step 1: Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Library**
3. Search for "Google Calendar API"
4. Click **Enable**

### Step 2: Configure OAuth Scopes

Add these scopes to your OAuth consent screen:

```
# Read-only access
https://www.googleapis.com/auth/calendar.readonly

# Read-write access
https://www.googleapis.com/auth/calendar.events
```

### Step 3: Create OAuth Credentials

Follow the OAuth setup in [Google README](./README.md)

---

## API Reference

**Base URL**: `https://www.googleapis.com/calendar/v3`

### List Events

```http
GET /calendars/primary/events
    ?timeMin={ISO_DATE}
    &timeMax={ISO_DATE}
    &maxResults=100
    &singleEvents=true
    &orderBy=startTime
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "items": [
    {
      "id": "event123",
      "summary": "Team Meeting",
      "description": "Weekly sync",
      "start": {
        "dateTime": "2025-01-05T10:00:00-05:00"
      },
      "end": {
        "dateTime": "2025-01-05T11:00:00-05:00"
      },
      "attendees": [
        {"email": "user@example.com", "responseStatus": "accepted"}
      ],
      "hangoutLink": "https://meet.google.com/abc-defg-hij"
    }
  ]
}
```

### Create Event

```http
POST /calendars/primary/events
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "summary": "New Meeting",
  "description": "Meeting description",
  "start": {
    "dateTime": "2025-01-06T10:00:00-05:00"
  },
  "end": {
    "dateTime": "2025-01-06T11:00:00-05:00"
  },
  "attendees": [
    {"email": "attendee@example.com"}
  ],
  "conferenceData": {
    "createRequest": {
      "requestId": "unique-id",
      "conferenceSolutionKey": {"type": "hangoutsMeet"}
    }
  }
}
```

### Get Free/Busy

```http
POST /freeBusy
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "timeMin": "2025-01-05T00:00:00Z",
  "timeMax": "2025-01-12T00:00:00Z",
  "items": [
    {"id": "primary"},
    {"id": "other@example.com"}
  ]
}
```

---

## Planned Edge Functions

### `google-calendar-sync` (To Be Created)

**Purpose**: Sync calendar events to meetings table

**Planned Features**:
- Fetch events from primary calendar
- Create/update meetings in database
- Handle event updates via webhooks
- Sync attendee information

### `google-calendar-create` (To Be Created)

**Purpose**: Create calendar events from Control Tower

**Planned Features**:
- Create events with attendees
- Auto-generate Meet links
- Send invitations

---

## Database Mapping

When implemented, calendar events will map to the `meetings` table:

| Calendar Field | Meetings Field |
|----------------|----------------|
| `id` | `metadata.google_event_id` |
| `summary` | `title` |
| `description` | `description` |
| `start.dateTime` | `scheduled_at` |
| `end - start` | `duration_minutes` |
| `hangoutLink` | `location` |

---

## Rate Limits

| Quota | Limit |
|-------|-------|
| Queries per day | 1,000,000 |
| Queries per 100 seconds per user | 500 |

---

## Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [Calendar API Reference](https://developers.google.com/calendar/api/v3/reference)
- [Push Notifications](https://developers.google.com/calendar/api/guides/push)

---

**Last Updated**: January 5, 2026
