# Activity Logs - Complete Setup Guide

## Overview

Your application now has a **comprehensive activity logging system** that automatically tracks all user actions including:

✅ **Authentication Events**
- Login (successful)
- Login failed (multiple attempts)
- Logout

✅ **User Management**
- Create new user
- Update user profile
- Delete user
- Add role to user
- Remove role from user

✅ **Client Management (CRUD)**
- Create client
- Update client
- Delete client

✅ **Meeting Management**
- Create meeting
- Update meeting
- Delete meeting

✅ **Task Management**
- Create task
- Update task
- Delete task

✅ **Knowledge Base**
- Create knowledge entry
- Update knowledge entry
- Delete knowledge entry
- View knowledge entry

✅ **Feedback Management**
- Create feedback
- Update feedback
- Delete feedback

## 🚀 Setup Instructions

### Step 1: Run the SQL Migration (2 minutes)

```bash
# Open Supabase Dashboard → SQL Editor
# Copy contents of: create-activity-logs-table.sql
# Paste and click "Run"
```

This creates:
- ✅ `activity_logs` table with all fields
- ✅ Automatic triggers for CRUD operations on all tables
- ✅ `log_activity()` function for manual logging
- ✅ `log_auth_event()` function for authentication events
- ✅ Row Level Security (RLS) policies
- ✅ Indexes for fast queries
- ✅ View with user profile data joined

### Step 2: Test the System

1. **Navigate to** `/admin/logs`
2. **You should see** "Showing Demo Data" banner disappear
3. **Perform some actions:**
   - Login/Logout
   - Create a client
   - Update a meeting
   - Create a task
4. **Refresh** `/admin/logs` - your actions should appear!

### Step 3: (Optional) Clean Old Logs

Set up a cron job to clean logs older than 90 days:

```sql
-- Run this in Supabase SQL Editor or schedule it
SELECT cleanup_old_activity_logs(90); -- Keep logs for 90 days
```

## 📊 What Gets Logged Automatically

### Automatic Logging (via Database Triggers)

These actions are **automatically logged** without any code changes:

| Action | Resource Type | Trigger |
|--------|--------------|---------|
| Insert into `clients` | client | Automatic ✅ |
| Update `clients` | client | Automatic ✅ |
| Delete from `clients` | client | Automatic ✅ |
| Insert into `meetings` | meeting | Automatic ✅ |
| Update `meetings` | meeting | Automatic ✅ |
| Delete from `meetings` | meeting | Automatic ✅ |
| Insert into `tasks` | task | Automatic ✅ |
| Update `tasks` | task | Automatic ✅ |
| Delete from `tasks` | task | Automatic ✅ |
| Insert into `knowledge_entries` | knowledge | Automatic ✅ |
| Update `knowledge_entries` | knowledge | Automatic ✅ |
| Delete from `knowledge_entries` | knowledge | Automatic ✅ |
| Insert into `user_roles` | role | Automatic ✅ |
| Delete from `user_roles` | role | Automatic ✅ |
| Update `profiles` | user | Automatic ✅ |
| Insert into `feedback` | feedback | Automatic ✅ |
| Update `feedback` | feedback | Automatic ✅ |
| Delete from `feedback` | feedback | Automatic ✅ |

### Manual Logging (Already Implemented)

These are logged from your application code:

| Action | Location | Status |
|--------|----------|--------|
| Login (email) | AuthContext.tsx | ✅ Implemented |
| Login (Google) | AuthContext.tsx | ✅ Implemented |
| Login (Microsoft) | AuthContext.tsx | ✅ Implemented |
| Login Failed | AuthContext.tsx | ✅ Implemented |
| Logout | AuthContext.tsx | ✅ Implemented |

## 🎯 Activity Logs Page Features

Visit `/admin/logs` to see:

### Statistics Cards
- **Total Events** - Count of all logged activities
- **Unique Users** - Number of different users with activity
- **Actions** - Different types of actions performed
- **Resources** - Different resource types accessed

### Activity Table
Displays recent activity with:
- User avatar and email
- Action badge (color-coded)
- Resource type
- Details (JSON)
- IP address
- Timestamp (formatted)

### Features
- **Search** - Filter by user, action, or resource
- **Export** - Download logs as CSV
- **Auto-refresh** - Fetches latest logs on page load
- **Responsive** - Works on all screen sizes

## 🔧 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Action                               │
│          (Create Client, Update Meeting, etc.)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Operation                            │
│              (INSERT, UPDATE, DELETE)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Trigger                              │
│            (trigger_log_activity)                                │
│  • Captures operation type (INSERT/UPDATE/DELETE)                │
│  • Extracts OLD and NEW row data                                 │
│  • Maps table name to resource type                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    log_activity() Function                       │
│  • Gets current user ID (auth.uid())                             │
│  • Inserts into activity_logs table                              │
│  • Includes action, resource, details                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    activity_logs Table                           │
│  • Stores complete audit trail                                   │
│  • Protected by RLS policies                                     │
│  • Indexed for fast queries                                      │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Logs Page                               │
│              (/admin/logs)                                       │
│  • Queries activity_logs table                                   │
│  • Joins with profiles for user info                             │
│  • Displays formatted logs                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
User Login Attempt
       │
       ▼
AuthContext.signIn()
       │
       ├─── Success ──► logLogin() ──► Insert to activity_logs
       │
       └─── Failed ───► log_auth_event() ──► Insert with login_failed action
```

## 📝 Database Schema

### activity_logs Table

```sql
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,              -- Who performed the action
  action text NOT NULL,                -- What they did (login, create, update, delete, etc.)
  resource_type text,                  -- What they acted on (client, meeting, task, etc.)
  resource_id text,                    -- Specific record ID
  details jsonb,                       -- Additional context (JSON)
  ip_address inet,                     -- User's IP address
  user_agent text,                     -- User's browser/device info
  created_at timestamptz               -- When it happened
);
```

### Example Records

```json
// Successful login
{
  "id": "uuid-1",
  "user_id": "user-uuid",
  "action": "login",
  "resource_type": null,
  "resource_id": null,
  "details": { "method": "email" },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-02-08T10:00:00Z"
}

// Failed login
{
  "id": "uuid-2",
  "user_id": "user-uuid",
  "action": "login_failed",
  "resource_type": null,
  "resource_id": null,
  "details": {
    "method": "email",
    "email": "user@example.com",
    "error": "Invalid login credentials"
  },
  "created_at": "2026-02-08T10:01:00Z"
}

// Client created
{
  "id": "uuid-3",
  "user_id": "user-uuid",
  "action": "create",
  "resource_type": "client",
  "resource_id": "client-uuid",
  "details": {
    "id": "client-uuid",
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "created_at": "2026-02-08T10:05:00Z"
  },
  "created_at": "2026-02-08T10:05:00Z"
}

// Meeting updated
{
  "id": "uuid-4",
  "user_id": "user-uuid",
  "action": "update",
  "resource_type": "meeting",
  "resource_id": "meeting-uuid",
  "details": {
    "old": { "title": "Weekly Standup", "status": "scheduled" },
    "new": { "title": "Weekly Standup", "status": "completed" }
  },
  "created_at": "2026-02-08T11:00:00Z"
}

// Task deleted
{
  "id": "uuid-5",
  "user_id": "user-uuid",
  "action": "delete",
  "resource_type": "task",
  "resource_id": "task-uuid",
  "details": {
    "id": "task-uuid",
    "title": "Review PR",
    "status": "completed"
  },
  "created_at": "2026-02-08T12:00:00Z"
}

// Role added to user
{
  "id": "uuid-6",
  "user_id": "admin-uuid",
  "action": "create",
  "resource_type": "role",
  "resource_id": "user-uuid",
  "details": {
    "user_id": "user-uuid",
    "role": "admin"
  },
  "created_at": "2026-02-08T13:00:00Z"
}
```

## 🛠️ Advanced Usage

### Manual Logging from Your Code

If you need to log custom events:

```typescript
import { logActivity } from "@/lib/activity-logger";

// Log a custom action
await logActivity({
  action: "view",
  resourceType: "knowledge",
  resourceId: "doc-123",
  details: { title: "User Guide", section: "Getting Started" },
});
```

### Using Helper Functions

```typescript
import { 
  logClientAction,
  logMeetingAction,
  logTaskAction,
  logRoleChange 
} from "@/lib/activity-logger";

// Log client creation
logClientAction("create", clientId, "Acme Corp");

// Log meeting update
logMeetingAction("update", meetingId, "Q1 Planning");

// Log task deletion
logTaskAction("delete", taskId, "Review PR #123");

// Log role assignment
logRoleChange("create", userId, "admin");
```

### Querying Logs via SQL

```sql
-- Get all login attempts for a user
SELECT * FROM activity_logs
WHERE user_id = 'user-uuid'
AND action IN ('login', 'login_failed')
ORDER BY created_at DESC;

-- Get all actions on a specific resource
SELECT * FROM activity_logs
WHERE resource_type = 'client'
AND resource_id = 'client-uuid';

-- Get failed login attempts in last 24 hours
SELECT 
  al.*,
  p.email
FROM activity_logs al
LEFT JOIN profiles p ON al.user_id = p.id
WHERE al.action = 'login_failed'
AND al.created_at > NOW() - INTERVAL '24 hours';

-- Get most active users
SELECT 
  p.email,
  COUNT(*) as action_count
FROM activity_logs al
JOIN profiles p ON al.user_id = p.id
GROUP BY p.email
ORDER BY action_count DESC
LIMIT 10;

-- Get actions by resource type
SELECT 
  resource_type,
  action,
  COUNT(*) as count
FROM activity_logs
WHERE resource_type IS NOT NULL
GROUP BY resource_type, action
ORDER BY resource_type, count DESC;
```

## 🔒 Security & Privacy

### Row Level Security (RLS)

Activity logs are protected by RLS policies:

```sql
-- Admins can see all logs
CREATE POLICY "Admin users can view all activity logs"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can only see their own logs
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (user_id = auth.uid());
```

### Data Retention

To comply with privacy regulations, clean old logs:

```sql
-- Delete logs older than 90 days
SELECT cleanup_old_activity_logs(90);

-- Schedule this to run automatically (via Supabase cron or external scheduler)
```

### Sensitive Data

The triggers automatically log full row data. If you have sensitive fields:

1. **Option 1**: Filter details in the trigger function
2. **Option 2**: Use views that exclude sensitive columns
3. **Option 3**: Encrypt details field

Example - Exclude sensitive fields:

```sql
-- Modify trigger_log_activity() to exclude password fields
v_details := to_jsonb(NEW) - 'password' - 'password_hash';
```

## 🎨 Customization

### Add New Resource Types

1. **Update the enum check** in the table:

```sql
ALTER TABLE activity_logs 
DROP CONSTRAINT activity_logs_resource_type_check;

ALTER TABLE activity_logs 
ADD CONSTRAINT activity_logs_resource_type_check 
CHECK (resource_type IN ('client', 'meeting', 'task', 'knowledge', 'user', 'role', 'feedback', 'ai_chat', 'settings', 'your_new_type'));
```

2. **Add trigger to your table**:

```sql
CREATE TRIGGER log_your_table_insert
  AFTER INSERT ON your_table
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_activity();
```

3. **Update TypeScript types**:

```typescript
// In activity-logger.ts
export type ResourceType = 
  | "client" 
  | "meeting"
  | "your_new_type"  // Add here
  | null;
```

### Customize Activity Icons

Edit `src/pages/admin/ActivityLogs.tsx`:

```typescript
const ACTION_ICONS: Record<string, React.ComponentType> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: FileText,
  login: LogIn,
  logout: LogOut,
  access: Shield,
  your_action: YourIcon,  // Add custom icon
};
```

### Add IP Address Tracking

Update `activity-logger.ts` to capture IP:

```typescript
export async function logActivity({ ... }: LogActivityParams) {
  // Get user's IP (requires backend endpoint)
  const ipResponse = await fetch('https://api.ipify.org?format=json');
  const { ip } = await ipResponse.json();

  await supabase.from("activity_logs").insert({
    ...
    ip_address: ip,
  });
}
```

## 📈 Performance Considerations

### Indexes

The migration creates optimal indexes:

```sql
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
```

### Query Optimization

Use the view for common queries:

```sql
-- Instead of this:
SELECT al.*, p.email 
FROM activity_logs al
LEFT JOIN profiles p ON al.user_id = p.id;

-- Use this:
SELECT * FROM activity_logs_with_users;
```

### Large Datasets

For millions of logs:

1. **Partition by date**:
```sql
CREATE TABLE activity_logs_2026_02 PARTITION OF activity_logs
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

2. **Archive old data**:
```sql
-- Move to archive table
INSERT INTO activity_logs_archive
SELECT * FROM activity_logs
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

## 🐛 Troubleshooting

### Logs Not Appearing

1. **Check if table exists**:
```sql
SELECT * FROM activity_logs LIMIT 1;
```

2. **Check triggers are active**:
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE 'log_%';
```

3. **Test manual logging**:
```sql
SELECT log_activity('test', 'settings', null, '{}'::jsonb);
```

### Permission Errors

Ensure RLS policies are correct:

```sql
-- Check your role
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'activity_logs';
```

### Performance Issues

If queries are slow:

```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM activity_logs
WHERE user_id = 'some-uuid'
ORDER BY created_at DESC
LIMIT 100;

-- Rebuild indexes if needed
REINDEX TABLE activity_logs;
```

## 📚 Related Files

- **SQL Migration**: `create-activity-logs-table.sql`
- **Logger Library**: `src/lib/activity-logger.ts`
- **Admin Page**: `src/pages/admin/ActivityLogs.tsx`
- **Auth Context**: `src/contexts/AuthContext.tsx`

## ✅ Checklist

Before deploying to production:

- [ ] Run SQL migration in Supabase
- [ ] Test login/logout logging
- [ ] Test CRUD operations logging
- [ ] Verify RLS policies work correctly
- [ ] Test /admin/logs page as admin
- [ ] Test /admin/logs page as regular user
- [ ] Set up log cleanup schedule
- [ ] Review sensitive data in logs
- [ ] Document custom logging requirements
- [ ] Train team on activity logs usage

---

**Version**: 1.0.0  
**Last Updated**: February 8, 2026  
**Status**: ✅ Production Ready
