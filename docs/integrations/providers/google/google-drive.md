# Google Drive Integration

![Status](https://img.shields.io/badge/Status-Partial-yellow)
![API](https://img.shields.io/badge/API-Drive%20v3-blue)

## Overview

Sync files from Google Drive folders to Control Tower for AI-powered search and knowledge management.

**Current Status**: File listing works with API key. Full sync requires OAuth implementation.

---

## Quick Start Checklist

- [ ] Google Cloud Console access
- [ ] Google Drive API enabled
- [ ] API key created (for public folder listing)
- [ ] OAuth credentials (for private file access)
- [ ] Environment variables configured

**Estimated Setup Time**: 20-30 minutes

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | For listing | API key for Drive file listing |
| `GOOGLE_CLIENT_ID` | For OAuth | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | For OAuth | OAuth 2.0 Client Secret |

---

## Setup Instructions

### Step 1: Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Library**
3. Search for "Google Drive API"
4. Click **Enable**

### Step 2: Create API Key (Public Folder Access)

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Click **Restrict Key**
4. Under **API restrictions**, select "Google Drive API"
5. Save the API key

### Step 3: Create OAuth Credentials (Private File Access)

1. Go to **APIs & Services** > **OAuth consent screen**
2. Configure consent screen (Internal for Workspace, External for testing)
3. Go to **Credentials** > **Create Credentials** > **OAuth client ID**
4. Application type: **Web application**
5. Add authorized redirect URIs:
   - `https://your-project.supabase.co/functions/v1/oauth-callback`
   - `http://localhost:54321/functions/v1/oauth-callback` (dev)
6. Save Client ID and Client Secret

---

## API Reference

**Base URL**: `https://www.googleapis.com/drive/v3`

### List Files in Folder

```http
GET /files?q='{folder_id}'+in+parents
    &key={API_KEY}
    &fields=files(id,name,mimeType,size,webViewLink,modifiedTime)
```

**Response:**
```json
{
  "files": [
    {
      "id": "1abc123",
      "name": "Document.pdf",
      "mimeType": "application/pdf",
      "size": "12345",
      "webViewLink": "https://drive.google.com/file/d/1abc123/view",
      "modifiedTime": "2025-01-05T10:00:00.000Z"
    }
  ]
}
```

### Download File Content

```http
GET /files/{file_id}?alt=media
Authorization: Bearer {access_token}
```

### Get File Metadata

```http
GET /files/{file_id}?fields=id,name,mimeType,size,webViewLink
Authorization: Bearer {access_token}
```

---

## Edge Functions

### `google-drive-sync`

**Purpose**: List and sync files from Google Drive folders

**Location**: `supabase/functions/google-drive-sync/index.ts`

**Required Secrets**: `GOOGLE_API_KEY`

**Usage**:
```typescript
const { data } = await supabase.functions.invoke('google-drive-sync', {
  body: { 
    action: 'list-files', 
    folder_id: 'your-folder-id' 
  }
});
```

### `google-drive-upload`

**Purpose**: Upload files to Google Drive

**Location**: `supabase/functions/google-drive-upload/index.ts`

**Status**: Placeholder - requires OAuth implementation

### `user-knowledge-drive-sync`

**Purpose**: Sync user's personal Drive files to knowledge base

**Location**: `supabase/functions/user-knowledge-drive-sync/index.ts`

**Status**: Placeholder - requires OAuth implementation

---

## Database Schema

Files synced from Drive are stored in user knowledge:

```sql
-- Existing user_knowledge table
source_type = 'google_drive'
source_id = drive_file_id
```

---

## Testing Checklist

### API Key Authentication
- [ ] `GOOGLE_API_KEY` is in Supabase secrets
- [ ] Can list files from shared/public folders
- [ ] Error handling for invalid folder IDs

### OAuth Flow (When Implemented)
- [ ] OAuth consent screen configured
- [ ] Redirect URIs are correct
- [ ] Token exchange works
- [ ] Token refresh works
- [ ] Can access private files

---

## Troubleshooting

### "API key not valid" error

**Cause**: API key not configured or restricted incorrectly

**Solution**:
1. Verify `GOOGLE_API_KEY` in Supabase secrets
2. Check API key has Drive API enabled
3. Ensure no IP restrictions blocking your server

### "File not found" error

**Cause**: File is private and requires OAuth

**Solution**:
1. For public files, ensure folder is shared
2. For private files, implement OAuth flow
3. Check folder ID is correct

### "Access Not Configured" error

**Cause**: Drive API not enabled

**Solution**:
1. Enable Google Drive API in Cloud Console
2. Wait 5-10 minutes for propagation

---

## Rate Limits

| Quota | Limit |
|-------|-------|
| Queries per day | 1,000,000,000 |
| Queries per 100 seconds per user | 1,000 |
| Queries per 100 seconds | 10,000 |

---

## Security Considerations

1. **Use OAuth for private files** - API keys only for public/shared folders
2. **Limit OAuth scopes** - Use `drive.readonly` unless write access needed
3. **Validate file ownership** - Ensure users can only access their synced files
4. **Store tokens securely** - Use Supabase's encrypted storage

---

## Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Drive API Reference](https://developers.google.com/drive/api/v3/reference)
- [OAuth 2.0 for Web Apps](https://developers.google.com/identity/protocols/oauth2/web-server)

---

**Last Updated**: January 5, 2026
