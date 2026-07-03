# Admin Dashboard - Quick Setup Checklist

## ✅ Quick Setup (5 minutes)

### Step 1: Run SQL Migration
```bash
# Open Supabase Dashboard → SQL Editor
# Copy and paste: create-admin-stats-function.sql
# Click "Run"
```

### Step 2: Verify Your Admin Role
```sql
-- Run this in SQL Editor to check your role
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- If you don't have admin role, add it:
INSERT INTO user_roles (user_id, role)
VALUES (auth.uid(), 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Step 3: (Optional) Add Edge Functions
```sql
-- Update this list with your actual edge functions
INSERT INTO edge_functions (name, description, status) VALUES
  ('ai-chat-assistant', 'AI chat with context', 'active'),
  ('semantic-search', 'Vector search', 'active'),
  ('google-drive', 'Google Drive sync', 'active')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description, 
    status = EXCLUDED.status;
```

### Step 4: Test the Dashboard
1. Navigate to `/admin` in your app
2. You should see dynamic statistics
3. Click "Refresh Stats" to update manually

## 🎯 What You Get

| Metric | Description | Updates |
|--------|-------------|---------|
| **Total Users** | Count of all registered users | Real-time |
| **Active Sessions** | Users active in last 24 hours | Real-time |
| **Database Size** | Actual database size | Real-time |
| **Edge Functions** | Count of deployed functions | Manual update |

## 🔧 Configuration

### Change Refresh Interval

Edit `src/hooks/useAdminStats.ts`:

```typescript
refetchInterval: 60000  // 1 minute (default)
refetchInterval: 120000 // 2 minutes
refetchInterval: 300000 // 5 minutes
```

### Add Custom Statistics

1. Update SQL function in `create-admin-stats-function.sql`
2. Add field to `AdminStats` interface in `useAdminStats.ts`
3. Add card to `Admin.tsx`

## 🐛 Troubleshooting

### Problem: Stats show 0
**Solution**: Run the SQL migration in Supabase

### Problem: "Failed to load" error
**Solution**: Check if you have admin role (Step 2)

### Problem: Edge Functions shows 0
**Solution**: Insert your functions in database (Step 3)

### Problem: Database size inaccurate
**Solution**: This is estimated. The SQL function provides more accurate size.

## 📊 Features

✅ Auto-refresh every minute
✅ Manual refresh button
✅ Loading skeletons
✅ Error handling
✅ Responsive design
✅ Dark mode support

## 🚀 Next Steps

Want to extend the dashboard? See `ADMIN_DASHBOARD_SETUP.md` for:
- Adding more statistics
- Tracking function invocations
- Creating historical trends
- Setting up alerts

## 📝 Files Modified

- ✅ `src/hooks/useAdminStats.ts` - NEW: Fetches dynamic stats
- ✅ `src/pages/Admin.tsx` - UPDATED: Uses dynamic data
- ✅ `create-admin-stats-function.sql` - NEW: Database function
- ✅ `ADMIN_DASHBOARD_SETUP.md` - NEW: Full documentation
- ✅ `ADMIN_STATS_QUICKSTART.md` - NEW: This file

---

**Ready to go!** Navigate to `/admin` and see your dynamic dashboard in action. 🎉
