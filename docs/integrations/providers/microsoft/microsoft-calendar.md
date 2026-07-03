# Microsoft Calendar (Outlook) Integration

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![API](https://img.shields.io/badge/API-Graph%20v1.0-blue)

## Overview

Sync calendar events from Microsoft Outlook/Exchange to Control Tower for meeting management and scheduling.

**Current Status**: Not implemented. Planned for future release.

---

## Quick Start Checklist

- [ ] Azure Portal access
- [ ] Microsoft 365 subscription
- [ ] Azure AD app registration completed
- [ ] Calendar API permissions granted
- [ ] Environment variables configured

**Estimated Setup Time**: 25-35 minutes

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MICROSOFT_CLIENT_ID` | Yes | Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Yes | Client secret value |
| `MICROSOFT_TENANT_ID` | Yes | Directory (tenant) ID |

---

## Planned Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Event Sync | Sync calendar events to meetings table | High |
| Event Creation | Create events from Control Tower | Medium |
| Free/Busy | Check availability | Medium |
| Room Booking | Book meeting rooms | Low |

---

## API Permissions

Add these Microsoft Graph permissions:

**Delegated Permissions:**
```
Calendars.Read
Calendars.ReadWrite
```

**Application Permissions (for background sync):**
```
Calendars.Read
Calendars.ReadWrite
```

---

## API Reference

**Base URL**: `https://graph.microsoft.com/v1.0`

### List Calendar Events

```http
GET /me/calendar/events
    ?$filter=start/dateTime ge '2025-01-01T00:00:00Z'
    &$orderby=start/dateTime
    &$top=50
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "value": [
    {
      "id": "event-id",
      "subject": "Team Meeting",
      "bodyPreview": "Weekly sync meeting",
      "start": {
        "dateTime": "2025-01-05T10:00:00.0000000",
        "timeZone": "UTC"
      },
      "end": {
        "dateTime": "2025-01-05T11:00:00.0000000",
        "timeZone": "UTC"
      },
      "location": {
        "displayName": "Conference Room A"
      },
      "organizer": {
        "emailAddress": {
          "name": "John Doe",
          "address": "john@example.com"
        }
      },
      "attendees": [
        {
          "emailAddress": {"address": "jane@example.com"},
          "status": {"response": "accepted"}
        }
      ],
      "onlineMeeting": {
        "joinUrl": "https://teams.microsoft.com/..."
      }
    }
  ]
}
```

### Create Calendar Event

```http
POST /me/calendar/events
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "subject": "New Meeting",
  "body": {
    "contentType": "HTML",
    "content": "Meeting agenda..."
  },
  "start": {
    "dateTime": "2025-01-06T10:00:00",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2025-01-06T11:00:00",
    "timeZone": "America/New_York"
  },
  "attendees": [
    {
      "emailAddress": {"address": "attendee@example.com"},
      "type": "required"
    }
  ],
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness"
}
```

### Get Free/Busy Schedule

```http
POST /me/calendar/getSchedule
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "schedules": ["user1@example.com", "user2@example.com"],
  "startTime": {
    "dateTime": "2025-01-05T00:00:00",
    "timeZone": "America/New_York"
  },
  "endTime": {
    "dateTime": "2025-01-12T00:00:00",
    "timeZone": "America/New_York"
  },
  "availabilityViewInterval": 30
}
```

### Find Meeting Times

```http
POST /me/findMeetingTimes
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "attendees": [
    {"emailAddress": {"address": "user@example.com"}}
  ],
  "timeConstraint": {
    "timeslots": [
      {
        "start": {"dateTime": "2025-01-06T09:00:00", "timeZone": "UTC"},
        "end": {"dateTime": "2025-01-06T17:00:00", "timeZone": "UTC"}
      }
    ]
  },
  "meetingDuration": "PT1H"
}
```

---

## Planned Edge Functions

### `microsoft-calendar-sync` (To Be Created)

**Purpose**: Sync Outlook calendar events to Control Tower

**Planned Features**:
- Fetch events from user's calendar
- Create/update meetings in database
- Handle event updates via webhooks
- Sync attendee responses

### `microsoft-calendar-create` (To Be Created)

**Purpose**: Create calendar events from Control Tower

**Planned Features**:
- Create events with attendees
- Auto-generate Teams meeting links
- Send invitations
- Book meeting rooms

---

## Database Mapping

When implemented, calendar events will map to the `meetings` table:

| Graph Field | Meetings Field |
|-------------|----------------|
| `id` | `metadata.outlook_event_id` |
| `subject` | `title` |
| `bodyPreview` | `description` |
| `start.dateTime` | `scheduled_at` |
| `end - start` | `duration_minutes` |
| `location.displayName` | `location` |
| `onlineMeeting.joinUrl` | `location` (if Teams) |

---

## Webhooks (Change Notifications)

Subscribe to calendar changes:

```http
POST /subscriptions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "changeType": "created,updated,deleted",
  "notificationUrl": "https://your-project.supabase.co/functions/v1/microsoft-webhook",
  "resource": "/me/events",
  "expirationDateTime": "2025-01-12T00:00:00Z",
  "clientState": "secret-state-value"
}
```

---

## Rate Limits

| Quota | Limit |
|-------|-------|
| Microsoft Graph | 10,000 requests per 10 minutes |
| Calendar operations | Subject to throttling |

---

## Resources

- [Outlook Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Event Resource](https://learn.microsoft.com/en-us/graph/api/resources/event)
- [Working with Calendar](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview)

---

**Last Updated**: January 5, 2026
