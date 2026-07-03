# Microsoft Teams Integration

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![API](https://img.shields.io/badge/API-Graph%20v1.0-blue)

## Overview

Integrate Microsoft Teams for meetings, chat, and collaboration features through the Microsoft Graph API.

**Current Status**: Not implemented. Planned for future release.

---

## Quick Start Checklist

- [ ] Azure Portal access with admin rights
- [ ] Microsoft 365 subscription (Business Basic or higher)
- [ ] Azure AD app registration completed
- [ ] The following environment variables ready:
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET`
  - `MICROSOFT_TENANT_ID`

**Estimated Setup Time**: 30-45 minutes

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
| Meeting Sync | Sync Teams meetings to meetings table | High |
| Create Meeting | Create Teams meetings from Control Tower | High |
| Recording Access | Download meeting recordings | Medium |
| Transcripts | Access meeting transcripts | Medium |
| Chat Integration | Send notifications to channels | Low |

---

## Setup Instructions

### Step 1: Register Azure AD Application

See [Microsoft README](./README.md) for detailed app registration steps.

### Step 2: Configure API Permissions

Add these Microsoft Graph permissions:

**Delegated Permissions:**
```
OnlineMeetings.Read
OnlineMeetings.ReadWrite
Team.ReadBasic.All
Channel.ReadBasic.All
User.Read
```

**Application Permissions (for background sync):**
```
OnlineMeetings.Read.All
CallRecords.Read.All
```

### Step 3: Grant Admin Consent

For application permissions, an admin must grant consent:

1. Go to **API permissions**
2. Click **Grant admin consent for [Organization]**
3. Confirm the consent dialog

---

## API Reference

**Base URL**: `https://graph.microsoft.com/v1.0`

### List User's Meetings

```http
GET /me/onlineMeetings
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "value": [
    {
      "id": "meeting-id",
      "subject": "Team Sync",
      "startDateTime": "2025-01-05T10:00:00Z",
      "endDateTime": "2025-01-05T11:00:00Z",
      "joinWebUrl": "https://teams.microsoft.com/l/meetup-join/...",
      "participants": {
        "organizer": {
          "identity": {
            "user": {"displayName": "John Doe"}
          }
        }
      }
    }
  ]
}
```

### Create Online Meeting

```http
POST /me/onlineMeetings
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "subject": "New Meeting",
  "startDateTime": "2025-01-06T10:00:00Z",
  "endDateTime": "2025-01-06T11:00:00Z",
  "participants": {
    "attendees": [
      {
        "identity": {
          "user": {"id": "user-id"}
        }
      }
    ]
  }
}
```

### Get Meeting Transcript

```http
GET /me/onlineMeetings/{meeting-id}/transcripts
Authorization: Bearer {access_token}
```

### List User's Teams

```http
GET /me/joinedTeams
Authorization: Bearer {access_token}
```

### List Team Channels

```http
GET /teams/{team-id}/channels
Authorization: Bearer {access_token}
```

### Send Channel Message

```http
POST /teams/{team-id}/channels/{channel-id}/messages
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "body": {
    "content": "Hello from Control Tower!"
  }
}
```

---

## Planned Edge Functions

### `microsoft-teams-sync` (To Be Created)

**Purpose**: Sync Teams meetings to Control Tower

**Planned Features**:
- Fetch user's online meetings
- Create/update meetings in database
- Handle meeting updates via webhooks
- Sync participant information

### `microsoft-teams-create` (To Be Created)

**Purpose**: Create Teams meetings from Control Tower

**Planned Features**:
- Create online meetings
- Generate join URLs
- Add participants

### `microsoft-teams-notify` (To Be Created)

**Purpose**: Send notifications to Teams channels

**Planned Features**:
- Post messages to channels
- Send adaptive cards
- Mention users

---

## Database Mapping

When implemented, Teams meetings will map to the `meetings` table:

| Graph Field | Meetings Field |
|-------------|----------------|
| `id` | `metadata.teams_meeting_id` |
| `subject` | `title` |
| `startDateTime` | `scheduled_at` |
| `endDateTime - startDateTime` | `duration_minutes` |
| `joinWebUrl` | `location` |
| `meeting_type` | `'teams'` |

---

## Webhooks (Change Notifications)

For real-time updates, implement Microsoft Graph webhooks:

```http
POST /subscriptions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "changeType": "created,updated,deleted",
  "notificationUrl": "https://your-project.supabase.co/functions/v1/microsoft-webhook",
  "resource": "/me/onlineMeetings",
  "expirationDateTime": "2025-01-12T00:00:00Z",
  "clientState": "secret-state-value"
}
```

---

## Rate Limits

| Resource | Limit |
|----------|-------|
| Microsoft Graph | 10,000 requests per 10 minutes |
| Teams messages | 1 message per second per channel |
| Meeting creation | 100 per day per user |

---

## Requirements

- Microsoft 365 Business Basic or higher
- Azure AD Premium (for some SSO features)
- Teams license for all meeting participants

---

## Resources

- [Microsoft Graph - Online Meetings](https://learn.microsoft.com/en-us/graph/api/resources/onlinemeeting)
- [Teams API Reference](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview)
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)

---

**Last Updated**: January 5, 2026
