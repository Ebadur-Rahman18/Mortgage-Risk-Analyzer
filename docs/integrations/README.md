# Integration Documentation

This directory contains detailed implementation guides for all supported third-party integrations in Control Tower.

---

## Available Integrations

| Provider | Category | Status | Documentation |
|----------|----------|--------|---------------|
| Zoom | Meetings | ✅ Available | [zoom.md](./providers/zoom.md) |
| Microsoft Teams | Meetings + Productivity | 🚧 Coming Soon | [microsoft/](./providers/microsoft/) |
| Google | AI + Auth + Productivity | 🔶 Partial | [google/](./providers/google/) |

---

## Integration Categories

### Authentication Providers

| Provider | Features | Status |
|----------|----------|--------|
| **Google Login** | Sign in with Google | ✅ Available |
| **Microsoft Azure AD** | Enterprise SSO | 🚧 Planned |

### Meeting Providers

| Provider | Features | Status |
|----------|----------|--------|
| **Zoom** | Meetings, recordings, transcripts, webhooks | ✅ Full support |
| **Microsoft Teams** | Meetings, calendar, call records | 🚧 Planned |
| **Google Meet** | Meetings via Google Workspace | 🚧 Planned |

### Productivity Suites

| Provider | Features | Status |
|----------|----------|--------|
| **Google Drive** | File sync, storage | 🔶 Partial |
| **Microsoft 365** | Calendar, OneDrive | 🚧 Planned |

### AI Providers

| Provider | Features | Status |
|----------|----------|--------|
| **OpenAI** | Chat (GPT-4), embeddings | ✅ Available |
| **Anthropic** | Chat (Claude) | ✅ Available |
| **Google Gemini** | Chat, embeddings | ✅ Available |
| **Perplexity** | Search | ✅ Available |

---

## Quick Reference

### Required Environment Variables by Provider

| Provider | Variables | Notes |
|----------|-----------|-------|
| **Zoom** | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID` | Server-to-Server OAuth |
| **Microsoft** | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | Azure AD App Registration |
| **Google Login** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth 2.0 for authentication |
| **Google Gemini** | `GOOGLE_AI_API_KEY` | API key for AI features |
| **Google Drive** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY` | OAuth + API key |
| **OpenAI** | `OPENAI_API_KEY` | Already configured ✅ |

### Edge Functions by Provider

| Provider | Edge Functions |
|----------|----------------|
| **Zoom** | `sync-zoom-files`, `zoom-transcript-processing`, `generate-meeting-summary` |
| **Microsoft** | `oauth-exchange-token`, `oauth-refresh-token` (shared) |
| **Google** | `google-drive-sync`, `google-drive-upload`, `user-knowledge-drive-sync` |
| **AI** | `ai-chat-assistant`, `generate-embeddings`, `run-ai-agent` |

### Feature Flags

Enable/disable integrations via **Admin > System Settings** or **Admin > Integrations**:

| Setting Path | Integration | Default |
|--------------|-------------|---------|
| `features.enableZoomSync` | Zoom recordings sync | `true` |
| `features.enableGoogleDrive` | Google Drive sync | `false` |
| `features.enableGoogleLogin` | Sign in with Google | `false` |
| `features.enableAIChat` | AI Chat assistant | `true` |

> **Note**: Most integrations are now configured via the Integration Hub at **Admin > Integrations**. The above feature flags are for backward compatibility.

---

## Documentation Template

When adding a new integration, follow this standardized structure:

```markdown
# {Provider} Integration Guide

## Overview
- Provider Type, Auth Method, API Version, Status

## Quick Start Checklist
- Prerequisites and estimated setup time

## Environment Variables
- Required secrets with descriptions

## Features
- Available services and capabilities

## Setup Instructions
- Step-by-step configuration guide

## API Reference
- Key endpoints with examples

## Webhooks (if applicable)
- Event types and payload examples

## Edge Function Implementation
- Existing functions and usage

## Database Schema
- Related tables and migrations

## Testing Checklist
- Verification steps

## Troubleshooting
- Common issues and solutions

## Rate Limits
- API quotas and limits

## Security Considerations
- Best practices

## Resources
- Links to official documentation
```

---

## Two-Tier Integration Architecture

Control Tower uses a **two-tier integration model** to support enterprise deployments:

### Tier 1: Admin/Organization Level
- Admin enables integrations for the company
- Stored in `organization_integrations` table
- Questions answered: "Does our company use Google/Zoom/etc.?"

### Tier 2: User/Individual Level
- User connects their personal account
- Stored in `user_oauth_tokens` table (Sprint 10)
- Questions answered: "Can I access MY Google Drive/Calendar?"

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TWO-TIER INTEGRATION MODEL                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TIER 1: ADMIN/ORGANIZATION LEVEL                                   │
│  ─────────────────────────────────                                  │
│  Location: Admin > Integrations                                      │
│  Storage: organization_integrations                                  │
│  Purpose: "Is this integration available for our company?"           │
│                                                                      │
│                         ↓                                            │
│                                                                      │
│  TIER 2: USER/INDIVIDUAL LEVEL                                      │
│  ─────────────────────────────                                       │
│  Location: Settings > Connected Services                             │
│  Storage: user_oauth_tokens                                          │
│  Purpose: "Connect MY personal account"                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Which Tier is Needed?

| Integration | Tier 1 Only | Tier 1 + Tier 2 |
|-------------|-------------|-----------------|
| AI Providers (OpenAI, Gemini) | Yes - uses company API key | |
| Google Login | Yes - enables sign-in | |
| Zoom | Yes - enables for company | Yes - user connects THEIR Zoom |
| Google Drive | Yes - enables for company | Yes - user connects THEIR Drive |
| Microsoft 365 | Yes - enables for company | Yes - user connects THEIR account |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Control Tower                             │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                                │
│  ├── Admin > Integrations Page (Tier 1)                          │
│  ├── Settings > Connected Services (Tier 2)                      │
│  ├── useIntegrations hook (Tier 1)                               │
│  ├── useUserIntegrations hook (Tier 2)                           │
│  └── ProviderCard, IntegrationConnectionCard components          │
├─────────────────────────────────────────────────────────────────┤
│  Edge Functions (Deno)                                           │
│  ├── oauth-exchange-token    ← Admin OAuth flow                  │
│  ├── oauth-refresh-token     ← Admin token refresh               │
│  ├── user-oauth-connect      ← User OAuth flow (Sprint 10)       │
│  ├── user-oauth-callback     ← User OAuth callback (Sprint 10)   │
│  ├── user-oauth-refresh      ← User token refresh (Sprint 10)    │
│  ├── sync-zoom-files         ← Zoom sync                         │
│  ├── google-drive-sync       ← Drive sync                        │
│  └── ai-chat-assistant       ← AI providers                      │
├─────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                                           │
│  ├── integration_providers       ← Provider definitions          │
│  ├── integration_categories      ← Category groupings            │
│  ├── integration_fields          ← Config field schemas          │
│  ├── organization_integrations   ← Tier 1: Admin configs         │
│  ├── user_oauth_tokens           ← Tier 2: User tokens           │
│  └── integration_usage_logs      ← Usage tracking                │
├─────────────────────────────────────────────────────────────────┤
│  External APIs                                                   │
│  ├── Zoom API (api.zoom.us)                                     │
│  ├── Microsoft Graph (graph.microsoft.com)                      │
│  ├── Google APIs (googleapis.com)                               │
│  └── AI APIs (OpenAI, Anthropic, etc.)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Adding New Integrations

### Step 1: Database Setup

1. Add provider to `integration_providers` table
2. Add category if new to `integration_categories`
3. Define config fields in `integration_fields`
4. Add services to `integration_services`

### Step 2: Edge Functions

1. Create OAuth flow (if applicable) or use shared functions
2. Create sync/API wrapper function
3. Add webhook handler (if applicable)
4. Add required secrets to Supabase

### Step 3: Frontend

1. Update `useIntegrations` hook if needed
2. Create provider-specific configuration UI
3. Add to admin integrations page

### Step 4: Documentation

1. Create `docs/integrations/providers/{provider}.md`
2. Follow the documentation template above
3. Update this README with the new provider

---

## Related Documentation

- [Integration Hub Implementation Plan](../INTEGRATION_HUB_IMPLEMENTATION_PLAN.md)
- [Integration API Reference](../INTEGRATION_API_REFERENCE.md)
- [Integration Data Flows](../INTEGRATION_DATA_FLOWS.md)
- [Integration User Guide](../INTEGRATION_USER_GUIDE.md)
- [Secrets Management](../SECRETS_MANAGEMENT.md)

---

## Support

For integration issues:

1. Check the specific provider documentation
2. Review Supabase Edge Function logs
3. Verify environment variables are set
4. Check API rate limits and quotas
5. Contact your system administrator

---

**Last Updated**: January 5, 2026  
**Version**: 1.0.0
