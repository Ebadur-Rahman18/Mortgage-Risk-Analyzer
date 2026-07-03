# Microsoft OneDrive Integration

![Status](https://img.shields.io/badge/Status-Planned-lightgrey)
![API](https://img.shields.io/badge/API-Graph%20v1.0-blue)

## Overview

Sync files from Microsoft OneDrive and SharePoint to Control Tower for document management and AI-powered search.

**Current Status**: Not implemented. Planned for future release.

---

## Quick Start Checklist

- [ ] Azure Portal access
- [ ] Microsoft 365 subscription with OneDrive
- [ ] Azure AD app registration completed
- [ ] Files API permissions granted
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
| File Listing | List files in user's OneDrive | High |
| File Download | Download files for processing | High |
| File Upload | Upload from Control Tower | Medium |
| Folder Sync | Sync specific folders | Medium |
| SharePoint | Access SharePoint document libraries | Low |

---

## API Permissions

Add these Microsoft Graph permissions:

**Delegated Permissions:**
```
Files.Read
Files.Read.All
Files.ReadWrite
Files.ReadWrite.All
```

**Application Permissions (for background sync):**
```
Files.Read.All
Files.ReadWrite.All
Sites.Read.All (for SharePoint)
```

---

## API Reference

**Base URL**: `https://graph.microsoft.com/v1.0`

### List Root Files

```http
GET /me/drive/root/children
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "value": [
    {
      "id": "item-id",
      "name": "Document.docx",
      "size": 12345,
      "file": {
        "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      "lastModifiedDateTime": "2025-01-05T10:00:00Z",
      "webUrl": "https://onedrive.live.com/...",
      "parentReference": {
        "driveId": "drive-id",
        "path": "/drive/root:"
      }
    }
  ]
}
```

### List Folder Contents

```http
GET /me/drive/items/{folder-id}/children
Authorization: Bearer {access_token}
```

### Search Files

```http
GET /me/drive/root/search(q='quarterly report')
Authorization: Bearer {access_token}
```

### Download File Content

```http
GET /me/drive/items/{item-id}/content
Authorization: Bearer {access_token}
```

### Upload File

```http
PUT /me/drive/root:/Documents/NewFile.txt:/content
Authorization: Bearer {access_token}
Content-Type: text/plain

File content here...
```

### Upload Large File (Resumable)

```http
POST /me/drive/root:/Documents/LargeFile.zip:/createUploadSession
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "item": {
    "@microsoft.graph.conflictBehavior": "rename"
  }
}
```

### Get Sharing Link

```http
POST /me/drive/items/{item-id}/createLink
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "type": "view",
  "scope": "organization"
}
```

---

## Planned Edge Functions

### `microsoft-onedrive-sync` (To Be Created)

**Purpose**: Sync OneDrive files to Control Tower

**Planned Features**:
- List files in specified folders
- Track file changes via delta API
- Download and process documents
- Generate embeddings for search

### `microsoft-onedrive-upload` (To Be Created)

**Purpose**: Upload files to OneDrive

**Planned Features**:
- Upload files from Control Tower
- Support large file uploads
- Create folder structures

---

## Database Schema

Files synced from OneDrive will be stored in user knowledge:

```sql
-- user_knowledge table
source_type = 'onedrive'
source_id = onedrive_item_id
```

---

## Delta Sync (Change Tracking)

Use the delta API for efficient syncing:

```http
GET /me/drive/root/delta
Authorization: Bearer {access_token}
```

**Response includes:**
- Changed items since last sync
- `@odata.deltaLink` for next sync
- Deleted items

---

## SharePoint Integration

Access SharePoint document libraries:

### List Sites

```http
GET /sites?search=*
Authorization: Bearer {access_token}
```

### List Document Libraries

```http
GET /sites/{site-id}/drives
Authorization: Bearer {access_token}
```

### List Library Contents

```http
GET /sites/{site-id}/drive/root/children
Authorization: Bearer {access_token}
```

---

## Rate Limits

| Quota | Limit |
|-------|-------|
| Microsoft Graph | 10,000 requests per 10 minutes |
| Upload/Download | 60 MB per request (single upload) |
| Large file upload | 60 GB max file size |

---

## Supported File Types

For text extraction and AI processing:

| Type | Extension | Notes |
|------|-----------|-------|
| Word | .docx, .doc | Full text extraction |
| PDF | .pdf | OCR for scanned docs |
| Text | .txt, .md | Direct processing |
| Excel | .xlsx, .xls | Table extraction |
| PowerPoint | .pptx, .ppt | Slide text extraction |

---

## Resources

- [OneDrive API](https://learn.microsoft.com/en-us/graph/api/resources/onedrive)
- [DriveItem Resource](https://learn.microsoft.com/en-us/graph/api/resources/driveitem)
- [Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [SharePoint API](https://learn.microsoft.com/en-us/graph/api/resources/sharepoint)

---

**Last Updated**: January 5, 2026
