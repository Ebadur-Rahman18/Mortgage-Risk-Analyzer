# Google Login Integration

![Status](https://img.shields.io/badge/Status-Available-green)
![Auth](https://img.shields.io/badge/Auth-OAuth%202.0-blue)

## Overview

Enable "Sign in with Google" on your Control Tower login page, allowing users to authenticate with their Google accounts for seamless access.

**Provider Type**: Authentication
**Auth Method**: OAuth 2.0
**Status**: Available

---

## Quick Start Checklist

- [ ] Google Cloud Console access
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 credentials created
- [ ] Client ID and Secret added to Integration Hub
- [ ] Integration enabled in admin settings

**Estimated Setup Time**: 15-20 minutes

---

## Prerequisites

1. **Google Cloud Account** with billing enabled (free tier works)
2. **Admin access** to Control Tower
3. **Verified domain** (optional, but recommended for production)

---

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** > **New Project**
3. Enter project name (e.g., "Control Tower Auth")
4. Click **Create**

### Step 2: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Select **External** (or Internal for Google Workspace)
3. Click **Create**
4. Fill in required fields:
   - **App name**: Your Control Tower instance name
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **Save and Continue**

#### Scopes

Add the following scopes:
- `openid` - Required for authentication
- `email` - User's email address
- `profile` - User's basic profile info

Click **Save and Continue**.

#### Test Users (Development)

If your app is in "Testing" mode, add test user emails:
1. Click **Add users**
2. Enter email addresses
3. Click **Save and Continue**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application**
4. Enter name: "Control Tower Login"
5. Add **Authorized redirect URIs**:

```
https://your-domain.com/admin/integrations/oauth/callback
http://localhost:5173/admin/integrations/oauth/callback  (for development)
```

6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 4: Configure in Control Tower

1. Log in as an administrator
2. Go to **Admin** > **Integrations**
3. Find **Google Login** under **Authentication** category
4. Click **Configure**
5. Enter:
   - **Client ID**: Your OAuth client ID
   - **Client Secret**: Your OAuth client secret
6. Click **Test Connection**
7. Click **Save & Activate**

### Step 5: Verify Integration

1. Log out of Control Tower
2. On the login page, you should see "Sign in with Google"
3. Click and complete the OAuth flow
4. Verify successful login

---

## Environment Variables

If configuring via environment variables instead of the Integration Hub:

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_LOGIN_CLIENT_ID` | Yes | OAuth 2.0 Client ID |
| `GOOGLE_LOGIN_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret |

Add to Supabase secrets:
```bash
GOOGLE_LOGIN_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_LOGIN_CLIENT_SECRET=GOCSPX-your-client-secret
```

---

## OAuth Configuration Details

### Authorization URL
```
https://accounts.google.com/o/oauth2/v2/auth
```

### Token URL
```
https://oauth2.googleapis.com/token
```

### Required Scopes
```
openid email profile
```

### Redirect URI Format
```
{your-domain}/admin/integrations/oauth/callback
```

---

## How It Works

### Authentication Flow

```
┌─────────────┐     ┌───────────────┐     ┌─────────────┐
│   User      │     │ Control Tower │     │   Google    │
└──────┬──────┘     └───────┬───────┘     └──────┬──────┘
       │                    │                    │
       │ 1. Click "Sign     │                    │
       │    in with Google" │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ 2. Redirect to     │
       │                    │    Google OAuth    │
       │◄───────────────────┼───────────────────►│
       │                    │                    │
       │ 3. User grants     │                    │
       │    permission      │                    │
       │────────────────────┼───────────────────►│
       │                    │                    │
       │                    │ 4. Redirect back   │
       │                    │    with auth code  │
       │◄───────────────────┼────────────────────│
       │                    │                    │
       │                    │ 5. Exchange code   │
       │                    │    for tokens      │
       │                    │───────────────────►│
       │                    │                    │
       │                    │ 6. Return tokens   │
       │                    │◄───────────────────│
       │                    │                    │
       │ 7. Create session  │                    │
       │◄───────────────────│                    │
       │                    │                    │
```

### Database Integration

When a user signs in with Google:

1. **New user**: Account is created with Google profile data
2. **Existing user**: Account is linked if email matches
3. **Session**: JWT token is issued for authentication

---

## Frontend Integration

### Login Page Component

The login page automatically shows "Sign in with Google" when the integration is enabled:

```tsx
// Check if Google Login is enabled
const { data: googleLogin } = useOrganizationIntegration('google-login');

// Render button if configured
{googleLogin?.connection_status === 'connected' && (
  <Button onClick={handleGoogleSignIn}>
    Sign in with Google
  </Button>
)}
```

### Integration Hook Usage

```tsx
import { useOrganizationIntegration } from '@/hooks/useIntegrations';

function LoginPage() {
  const { data: googleLogin, isLoading } = useOrganizationIntegration('google-login');

  const isGoogleEnabled = googleLogin?.connection_status === 'connected';

  // ...
}
```

---

## Admin Configuration UI

Navigate to **Admin > Integrations > Google Login**:

```
┌──────────────────────────────────────────────────────┐
│ Configure Google Login                          [×]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Step 1: Google Cloud Console Setup                   │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ 1. Go to Google Cloud Console                        │
│    [Open Console →]                                  │
│                                                      │
│ 2. Create OAuth 2.0 credentials                      │
│                                                      │
│ 3. Configure consent screen                          │
│                                                      │
│ [Full Setup Guide]                                   │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Step 2: Enter Your Credentials                       │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Client ID *                                          │
│ [________________________.apps.googleusercontent.com]│
│                                                      │
│ Client Secret *                                      │
│ [••••••••••••••••••••••]  ☑ Show                    │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ [Test Connection]    [Cancel]    [Save & Activate]   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Best Practices

1. **Use HTTPS** in production - OAuth requires secure connections
2. **Restrict redirect URIs** - Only add your actual domains
3. **Don't expose Client Secret** - Store securely in database/secrets
4. **Verify email domain** (optional) - Restrict to specific domains
5. **Enable MFA** - Google accounts with 2FA are more secure

### Domain Restrictions

To limit sign-in to specific email domains:

1. Go to Google Cloud Console > OAuth consent screen
2. Under "Domain verification", add your domains
3. In your app, verify `email.endsWith('@yourdomain.com')`

### Rate Limits

Google OAuth has generous limits:
- 10,000 users per OAuth consent screen (testing mode: 100)
- No explicit rate limits for authentication

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

**Cause**: Redirect URI doesn't match configured URIs

**Solution**:
1. Go to Google Cloud Console > Credentials
2. Edit your OAuth client
3. Add the exact redirect URI from the error
4. Wait 5 minutes for propagation

### "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not properly configured

**Solution**:
1. Complete all required fields in consent screen
2. Add your email to test users (if in testing mode)
3. Verify scopes are properly configured

### "Sign in with Google" button not showing

**Cause**: Integration not configured or not enabled

**Solution**:
1. Go to Admin > Integrations > Google Login
2. Verify status is "Connected"
3. Check browser console for errors
4. Clear browser cache

### Token exchange fails

**Cause**: Invalid or expired credentials

**Solution**:
1. Regenerate Client Secret in Google Console
2. Update credentials in Integration Hub
3. Test connection again

---

## Testing Checklist

- [ ] OAuth consent screen is configured
- [ ] Client ID and Secret are saved in Integration Hub
- [ ] Test connection succeeds
- [ ] "Sign in with Google" button appears on login page
- [ ] OAuth flow completes successfully
- [ ] New user account is created on first sign-in
- [ ] Existing user can sign in with matching email
- [ ] Session is properly created after sign-in

---

## Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google Identity Platform](https://developers.google.com/identity)

---

**Last Updated**: January 5, 2026
