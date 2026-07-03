# Azure AD / SSO Integration

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![Auth](https://img.shields.io/badge/Auth-SAML%20%2F%20OIDC-blue)

## Overview

Enable Single Sign-On (SSO) with Azure Active Directory for enterprise authentication and user provisioning.

**Current Status**: Not implemented. Planned for future release.

---

## Quick Start Checklist

- [ ] Azure Portal access with admin rights
- [ ] Azure AD Premium P1 or P2 (for SAML SSO)
- [ ] Enterprise application created
- [ ] SSO configuration completed
- [ ] Environment variables configured

**Estimated Setup Time**: 45-60 minutes

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MICROSOFT_CLIENT_ID` | Yes | Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Yes | Client secret value |
| `MICROSOFT_TENANT_ID` | Yes | Directory (tenant) ID |
| `AZURE_AD_ISSUER` | For SAML | SAML issuer URL |
| `AZURE_AD_SSO_URL` | For SAML | SSO endpoint URL |
| `AZURE_AD_CERTIFICATE` | For SAML | X.509 certificate |

---

## Planned Features

| Feature | Description | Priority |
|---------|-------------|----------|
| OIDC SSO | OpenID Connect authentication | High |
| SAML SSO | SAML 2.0 authentication | High |
| User Provisioning | SCIM-based user sync | Medium |
| Group Sync | Sync AD groups to roles | Medium |
| MFA Enforcement | Require MFA via Conditional Access | Low |

---

## Authentication Methods

### Option 1: OpenID Connect (OIDC)

**Recommended for**: New implementations, simpler setup

**Flow:**
1. User clicks "Sign in with Microsoft"
2. Redirect to Azure AD login
3. User authenticates
4. Azure AD returns ID token
5. Control Tower creates/updates user session

### Option 2: SAML 2.0

**Recommended for**: Enterprise requirements, existing SAML infrastructure

**Flow:**
1. User accesses Control Tower
2. SP-initiated SAML request to Azure AD
3. User authenticates
4. Azure AD returns SAML assertion
5. Control Tower validates and creates session

---

## OIDC Configuration

### Step 1: Register Application

1. Go to **Azure AD** > **App registrations** > **New registration**
2. Name: "Control Tower SSO"
3. Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Select "Accounts in this organizational directory only"

### Step 2: Configure Authentication

1. Go to **Authentication**
2. Add redirect URIs:
   - `https://your-domain.com/auth/callback`
   - `https://your-project.supabase.co/auth/v1/callback`
3. Enable ID tokens

### Step 3: Configure Supabase Auth

In Supabase Dashboard > Authentication > Providers > Azure:

```
Azure AD Enabled: ON
Client ID: <MICROSOFT_CLIENT_ID>
Client Secret: <MICROSOFT_CLIENT_SECRET>
Azure Tenant URL: https://login.microsoftonline.com/<TENANT_ID>
```

---

## SAML Configuration

### Step 1: Create Enterprise Application

1. Go to **Azure AD** > **Enterprise applications** > **New application**
2. Select "Create your own application"
3. Name: "Control Tower"
4. Select "Integrate any other application you don't find in the gallery (Non-gallery)"

### Step 2: Configure SAML

1. Go to **Single sign-on** > **SAML**
2. Set Basic SAML Configuration:
   - **Identifier (Entity ID)**: `https://your-domain.com/saml/metadata`
   - **Reply URL (ACS)**: `https://your-domain.com/saml/acs`
   - **Sign on URL**: `https://your-domain.com/login`

### Step 3: Configure Attributes & Claims

Map Azure AD attributes to SAML claims:

| Claim | Source Attribute |
|-------|------------------|
| `email` | `user.mail` |
| `name` | `user.displayname` |
| `firstName` | `user.givenname` |
| `lastName` | `user.surname` |
| `groups` | `user.groups` |

### Step 4: Download Certificate

1. In **SAML Signing Certificate** section
2. Download **Certificate (Base64)**
3. Store as `AZURE_AD_CERTIFICATE` secret

### Step 5: Copy URLs

From **Set up Control Tower** section:
- **Login URL** → `AZURE_AD_SSO_URL`
- **Azure AD Identifier** → `AZURE_AD_ISSUER`

---

## User Provisioning (SCIM)

### Enable Automatic Provisioning

1. Go to **Provisioning** > **Get started**
2. Set Provisioning Mode to **Automatic**
3. Configure Admin Credentials:
   - **Tenant URL**: `https://your-domain.com/scim/v2`
   - **Secret Token**: Generate in Control Tower admin

### Attribute Mapping

| Azure AD Attribute | Control Tower Attribute |
|--------------------|------------------------|
| `userPrincipalName` | `email` |
| `displayName` | `full_name` |
| `surname` | `metadata.last_name` |
| `givenName` | `metadata.first_name` |
| `jobTitle` | `metadata.job_title` |
| `department` | `metadata.department` |

---

## Planned Edge Functions

### `azure-ad-saml-callback` (To Be Created)

**Purpose**: Handle SAML assertions from Azure AD

**Features**:
- Validate SAML response signature
- Extract user attributes
- Create/update user in database
- Generate session token

### `azure-ad-scim` (To Be Created)

**Purpose**: Handle SCIM provisioning requests

**Endpoints**:
- `POST /Users` - Create user
- `GET /Users/{id}` - Get user
- `PATCH /Users/{id}` - Update user
- `DELETE /Users/{id}` - Deactivate user
- `GET /Groups` - List groups

---

## Database Schema

SSO configuration will be stored in a new table:

```sql
-- sso_configurations table (planned)
CREATE TABLE sso_configurations (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL, -- 'azure_ad', 'okta', 'google'
  protocol TEXT NOT NULL, -- 'oidc', 'saml'
  client_id TEXT,
  issuer_url TEXT,
  sso_url TEXT,
  certificate TEXT,
  metadata_url TEXT,
  attribute_mapping JSONB,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Group-to-Role Mapping

Map Azure AD groups to Control Tower roles:

| Azure AD Group | Control Tower Role |
|----------------|-------------------|
| `Control Tower Admins` | `admin` |
| `Control Tower Moderators` | `moderator` |
| `Control Tower Users` | `user` |

Configuration in app_config:

```json
{
  "sso": {
    "group_mapping": {
      "azure-group-id-1": "admin",
      "azure-group-id-2": "moderator",
      "azure-group-id-3": "user"
    }
  }
}
```

---

## Conditional Access

Configure Azure AD Conditional Access policies:

| Policy | Setting |
|--------|---------|
| Require MFA | All users accessing Control Tower |
| Block legacy auth | Require modern authentication |
| Device compliance | Require managed devices (optional) |
| Location-based | Block access from untrusted locations |

---

## Resources

- [Azure AD OIDC Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-protocols-oidc)
- [Azure AD SAML Documentation](https://learn.microsoft.com/en-us/azure/active-directory/manage-apps/configure-saml-single-sign-on)
- [SCIM Provisioning](https://learn.microsoft.com/en-us/azure/active-directory/app-provisioning/use-scim-to-provision-users-and-groups)
- [Supabase Azure Provider](https://supabase.com/docs/guides/auth/social-login/auth-azure)

---

**Last Updated**: January 5, 2026
