# Microsoft Integration Overview

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![Auth](https://img.shields.io/badge/Auth-OAuth%202.0-blue)

## Overview

The Microsoft integration provides access to Microsoft 365 services through Azure AD OAuth 2.0 authentication using Microsoft Graph API.

## Available Services

| Service | Documentation | Status | Priority |
|---------|---------------|--------|----------|
| Microsoft Teams | [microsoft-teams.md](./microsoft-teams.md) | Planned | High |
| Microsoft Calendar | [microsoft-calendar.md](./microsoft-calendar.md) | Planned | High |
| Microsoft OneDrive | [microsoft-onedrive.md](./microsoft-onedrive.md) | Planned | Medium |
| Azure AD (SSO) | [microsoft-azure-ad.md](./microsoft-azure-ad.md) | Planned | High |

## Quick Start

### 1. Azure Portal Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Register a new application
4. Configure API permissions
5. Create client secret

### 2. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MICROSOFT_CLIENT_ID` | Yes | Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Yes | Client secret value |
| `MICROSOFT_TENANT_ID` | Yes | Directory (tenant) ID |

### 3. Add to Supabase Secrets

```bash
# Via Supabase Dashboard > Project Settings > Edge Functions > Secrets
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

## Microsoft Graph API

All Microsoft 365 services are accessed through the unified Microsoft Graph API.

**Base URL**: `https://graph.microsoft.com/v1.0`

### Common Endpoints

| Service | Endpoint |
|---------|----------|
| User Profile | `/me` |
| Calendar Events | `/me/calendar/events` |
| Teams | `/me/joinedTeams` |
| OneDrive Files | `/me/drive/root/children` |
| Mail | `/me/messages` |

## OAuth Scopes

When implementing OAuth, request only necessary scopes:

```
# User profile
User.Read

# Calendar (read-only)
Calendars.Read

# Calendar (read-write)
Calendars.ReadWrite

# Teams (read-only)
Team.ReadBasic.All
Channel.ReadBasic.All

# OneDrive (read-only)
Files.Read.All

# OneDrive (read-write)
Files.ReadWrite.All
```

## Edge Functions

| Function | Service | Purpose |
|----------|---------|---------|
| `oauth-exchange-token` | All | Exchange OAuth code for tokens |
| `oauth-refresh-token` | All | Refresh expired tokens |
| `microsoft-teams-sync` | Teams | Sync Teams meetings (planned) |
| `microsoft-calendar-sync` | Calendar | Sync calendar events (planned) |
| `microsoft-onedrive-sync` | OneDrive | Sync files (planned) |

## App Registration Steps

### Step 1: Register Application

1. Go to **Azure AD** > **App registrations** > **New registration**
2. Name: "Control Tower Integration"
3. Supported account types: Choose based on your needs
   - Single tenant: Your organization only
   - Multitenant: Any Microsoft account
4. Redirect URI: `https://your-project.supabase.co/functions/v1/oauth-callback`

### Step 2: Configure API Permissions

1. Go to **API permissions** > **Add a permission**
2. Select **Microsoft Graph**
3. Choose **Delegated permissions**
4. Add required scopes (see OAuth Scopes above)
5. Click **Grant admin consent** (if admin)

### Step 3: Create Client Secret

1. Go to **Certificates & secrets** > **New client secret**
2. Description: "Control Tower"
3. Expiration: Choose appropriate duration
4. **Save the secret value immediately** (shown only once)

### Step 4: Note Application IDs

From the **Overview** page, copy:
- **Application (client) ID** → `MICROSOFT_CLIENT_ID`
- **Directory (tenant) ID** → `MICROSOFT_TENANT_ID`

## Resources

- [Azure Portal](https://portal.azure.com/)
- [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
- [Microsoft Graph Documentation](https://learn.microsoft.com/en-us/graph/)
- [App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

**Last Updated**: January 5, 2026
