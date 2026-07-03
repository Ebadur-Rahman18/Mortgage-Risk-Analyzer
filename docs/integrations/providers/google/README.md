# Google Integration Overview

![Status](https://img.shields.io/badge/Status-Partial-yellow)
![Auth](https://img.shields.io/badge/Auth-OAuth%202.0-blue)

## Overview

The Google integration provides access to Google Workspace services, Google AI, and Google Authentication through OAuth 2.0 and API key authentication.

## Available Services

| Service | Documentation | Status | Priority |
|---------|---------------|--------|----------|
| Google Login | [google-login.md](./google-login.md) | Available | High |
| Google AI (Gemini) | [google-ai.md](./google-ai.md) | Available | High |
| Google Drive | [google-drive.md](./google-drive.md) | Partial | High |
| Google Calendar | [google-calendar.md](./google-calendar.md) | Planned | Medium |
| Google Meet | [google-meet.md](./google-meet.md) | Planned | Medium |

## Quick Start

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable required APIs (see individual service docs)
4. Create OAuth 2.0 credentials and/or API keys

### 2. Environment Variables

| Variable | Required For | Description |
|----------|--------------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth (Drive, Calendar, Meet, Login) | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth (Drive, Calendar, Meet, Login) | OAuth 2.0 Client Secret |
| `GOOGLE_API_KEY` | Drive (public) | API key for Drive listing |
| `GOOGLE_AI_API_KEY` | Gemini | API key for AI features |

### 3. Add to Supabase Secrets

```bash
# Via Supabase Dashboard > Project Settings > Edge Functions > Secrets
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_API_KEY=your-api-key
GOOGLE_AI_API_KEY=your-ai-api-key
```

## Integration Hub Configuration

All Google services can be configured through the **Admin > Integration Hub**:

| Provider | Category | Auth Type | Configure Via |
|----------|----------|-----------|---------------|
| Google Login | Authentication | OAuth 2.0 | Admin > Integrations |
| Google Gemini | AI Providers | API Key | Admin > Integrations |
| Google Workspace | Storage & Productivity | OAuth 2.0 | Admin > Integrations |
| Google Meet | Meeting Providers | OAuth 2.0 | Admin > Integrations |

## Edge Functions

| Function | Service | Purpose |
|----------|---------|---------|
| `oauth-exchange-token` | All OAuth | Exchange auth code for tokens |
| `oauth-refresh-token` | All OAuth | Refresh expired tokens |
| `google-drive-sync` | Drive | List and sync files |
| `google-drive-upload` | Drive | Upload files (needs OAuth) |
| `user-knowledge-drive-sync` | Drive | Sync to knowledge base |
| `ai-chat-assistant` | Gemini | AI chat completions |
| `generate-embeddings` | Gemini | Text embeddings |

## OAuth Scopes

When implementing OAuth, request only necessary scopes:

```
# Authentication (Google Login)
openid
email
profile

# Drive (read-only)
https://www.googleapis.com/auth/drive.readonly

# Drive (read-write)
https://www.googleapis.com/auth/drive.file

# Calendar (read-only)
https://www.googleapis.com/auth/calendar.readonly

# Calendar (read-write)
https://www.googleapis.com/auth/calendar.events

# Meet
https://www.googleapis.com/auth/meetings.space.created
```

## Two-Tier Integration Model

Google integrations follow a **two-tier model**:

| Tier | Purpose | Storage | Configured By |
|------|---------|---------|---------------|
| **Tier 1: Admin** | Enable integrations for the company | `organization_integrations` | Admin |
| **Tier 2: User** | Connect individual accounts | `user_oauth_tokens` | Each User |

### When Each Tier is Needed

| Provider | Tier 1 (Admin) | Tier 2 (User) | Notes |
|----------|----------------|---------------|-------|
| Google Login | Yes | Automatic | User signs in with Google |
| Google Gemini | Yes | No | Uses company API key |
| Google Workspace | Yes | Yes | User connects their Drive/Calendar |
| Google Meet | Yes | Yes | User connects for meeting sync |

## Frontend Integration

### Tier 1: Check Admin Configuration (Organization Level)

```tsx
import { useOrganizationIntegration } from '@/hooks/useIntegrations';

function AdminConfigCheck() {
  // Check if admin has configured Google integrations
  const { data: googleLogin } = useOrganizationIntegration('google-login');
  const { data: googleAI } = useOrganizationIntegration('google-gemini');
  const { data: googleWorkspace } = useOrganizationIntegration('google-workspace');

  const isGoogleLoginEnabled = googleLogin?.connection_status === 'connected';
  const isGeminiEnabled = googleAI?.connection_status === 'connected';
  const isWorkspaceEnabled = googleWorkspace?.connection_status === 'connected';
  // ...
}
```

### Tier 2: Check User Connection (Individual Level)

```tsx
import { useUserOAuthToken } from '@/hooks/useUserIntegrations';

function UserConnectionCheck() {
  // Check if user has connected their Google account
  const { data: googleToken, isLoading } = useUserOAuthToken('google');

  const isUserConnected = googleToken?.is_active && googleToken?.expires_at > new Date();
  const connectedEmail = googleToken?.account_email;

  return (
    <div>
      {isUserConnected ? (
        <p>Connected as {connectedEmail}</p>
      ) : (
        <button onClick={connectGoogle}>Connect Google</button>
      )}
    </div>
  );
}
```

### Combined Check (Recommended Pattern)

```tsx
import { useOrganizationIntegration } from '@/hooks/useIntegrations';
import { useUserOAuthToken } from '@/hooks/useUserIntegrations';

function GoogleIntegrationStatus() {
  // Tier 1: Is Google enabled by admin?
  const { data: orgConfig } = useOrganizationIntegration('google-workspace');
  const isAdminEnabled = orgConfig?.connection_status === 'connected';

  // Tier 2: Has user connected their account?
  const { data: userToken } = useUserOAuthToken('google');
  const isUserConnected = userToken?.is_active;

  if (!isAdminEnabled) {
    return <p>Google is not available. Contact your administrator.</p>;
  }

  if (!isUserConnected) {
    return <button>Connect your Google account</button>;
  }

  return <p>Connected as {userToken.account_email}</p>;
}
```

### Configure Provider (Admin)

```tsx
import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const navigate = useNavigate();

  const configureGoogleLogin = () => {
    navigate('/admin/integrations/google-login');
  };

  const configureGemini = () => {
    navigate('/admin/integrations/google-gemini');
  };
  // ...
}
```

### Connect User Account (User)

```tsx
import { useConnectOAuth, useDisconnectOAuth } from '@/hooks/useUserIntegrations';

function UserSettingsPage() {
  const connectGoogle = useConnectOAuth();
  const disconnectGoogle = useDisconnectOAuth();

  const handleConnect = async () => {
    await connectGoogle.mutateAsync({ provider: 'google' });
    // Redirects to Google OAuth consent screen
  };

  const handleDisconnect = async () => {
    await disconnectGoogle.mutateAsync({ provider: 'google' });
    // Revokes tokens and removes connection
  };

  // ...
}
```

## Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google APIs Explorer](https://developers.google.com/apis-explorer)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google AI Studio](https://aistudio.google.com/)
- [Google Identity Platform](https://developers.google.com/identity)

---

**Last Updated**: January 5, 2026
