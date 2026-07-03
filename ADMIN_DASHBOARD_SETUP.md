# Admin Dashboard Setup Guide

## Overview

The Admin Dashboard now displays **dynamic, real-time statistics** including:
- **Total Users**: Count of all registered users
- **Active Sessions**: Users active in the last 24 hours
- **Database Size**: Actual or estimated database size
- **Edge Functions**: Count of deployed edge functions

All statistics automatically refresh every minute and can be manually refreshed with the "Refresh Stats" button.

## Setup Instructions

### Step 1: Run the SQL Migration

Execute the SQL file in your Supabase SQL Editor to set up the necessary database functions and tables:

```bash
# Copy the contents of create-admin-stats-function.sql
# Paste it into Supabase Dashboard > SQL Editor > New Query
# Run the query
```

Or use the Supabase CLI:

```bash
supabase db execute --file create-admin-stats-function.sql
```

This SQL migration creates:

1. **`get_admin_stats()` Function**: Returns comprehensive statistics including:
   - Total users count
   - Active sessions (last 24 hours)
   - New users this month
   - Database size (formatted)
   - Timestamp of the query

2. **`edge_functions` Table**: Tracks deployed edge functions with:
   - Function name and description
   - Status (active, inactive, deprecated)
   - Version information
   - Invocation count and last invoked timestamp
   - Row Level Security (RLS) policies for admin-only access

3. **`admin_statistics` View**: Alternative way to access stats via SQL

4. **Helper Functions**: 
   - `increment_edge_function_invocation()`: Track function usage

5. **Indexes**: Performance optimization for date-based queries

### Step 2: Verify Database Permissions

The `get_admin_stats()` function uses `SECURITY DEFINER` to access database statistics. Verify that:

1. The function was created successfully
2. The `edge_functions` table has proper RLS policies
3. Admin users have the correct role in `user_roles` table

```sql
-- Verify the function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_admin_stats';

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'edge_functions';

-- Check your admin role
SELECT * FROM user_roles WHERE user_id = auth.uid();
```

### Step 3: Add Edge Functions to Database (Optional)

If you have edge functions deployed, add them to the tracking table:

```sql
INSERT INTO edge_functions (name, description, status) VALUES
  ('function-name-1', 'Description of function 1', 'active'),
  ('function-name-2', 'Description of function 2', 'active'),
  ('function-name-3', 'Description of function 3', 'inactive')
ON CONFLICT (name) DO NOTHING;
```

The SQL migration already includes some example functions. Update them based on your actual deployments.

### Step 4: Test the Admin Dashboard

1. Navigate to `/admin` in your application
2. Ensure you're logged in as an admin user
3. Verify that all statistics are loading correctly
4. Test the "Refresh Stats" button

## Features

### Real-Time Statistics

The dashboard displays:

#### Total Users
- Shows the total count of registered users
- Displays new users added this month
- Updates automatically every minute

#### Active Sessions
- Counts users active in the last 24 hours
- Based on `updated_at` timestamp in profiles
- Helps monitor current platform usage

#### Database Size
- Displays actual database size (if permissions allow)
- Falls back to estimated size based on table sizes
- Shows weekly growth estimate
- Formatted in KB, MB, or GB automatically

#### Edge Functions
- Counts active edge functions from the `edge_functions` table
- Only includes functions with status = 'active'
- Can be updated by inserting/updating records in the database

### Auto-Refresh

- Statistics automatically refresh every 60 seconds
- Data is considered stale after 30 seconds
- Manual refresh available via button in header

### Loading States

- Skeleton loaders show during initial load
- Refresh button shows spinner during updates
- Error messages display if stats fail to load

### Error Handling

- Graceful fallback if SQL function doesn't exist
- Client-side estimation if database queries fail
- User-friendly error messages
- Console logging for debugging

## Architecture

### Custom Hook: `useAdminStats`

Location: `src/hooks/useAdminStats.ts`

The hook uses TanStack Query for efficient data fetching:

```typescript
const { data, isLoading, error } = useAdminStats();
```

Features:
- Automatic refetching every 60 seconds
- 30-second stale time for optimal performance
- Caching to reduce database load
- Fallback logic if SQL function unavailable

### SQL Function: `get_admin_stats()`

Returns a JSON object with all statistics in a single query:

```sql
SELECT * FROM get_admin_stats();
```

Response format:
```json
{
  "total_users": 42,
  "active_sessions": 12,
  "new_users_month": 5,
  "database_size": "2.4 GB",
  "database_size_bytes": 2576980377,
  "timestamp": "2026-02-08T10:30:00Z"
}
```

### Edge Functions Table Schema

```sql
CREATE TABLE edge_functions (
  id uuid PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  status text DEFAULT 'active',
  version text,
  deployed_at timestamptz,
  last_invoked_at timestamptz,
  invocation_count integer DEFAULT 0,
  created_at timestamptz,
  updated_at timestamptz
);
```

## Customization

### Adjust Refresh Interval

Edit `src/hooks/useAdminStats.ts`:

```typescript
return useQuery({
  queryKey: ["admin-stats"],
  queryFn: fetchAdminStats,
  refetchInterval: 120000, // Change to 2 minutes
  staleTime: 60000, // Change to 1 minute
});
```

### Add More Statistics

1. Update the SQL function in `create-admin-stats-function.sql`
2. Add the new field to the `AdminStats` interface
3. Update the Admin page to display the new stat

Example - Add total meetings count:

```sql
-- In get_admin_stats() function
DECLARE
  total_meetings integer;
BEGIN
  SELECT COUNT(*) INTO total_meetings FROM meetings;
  
  result := jsonb_build_object(
    ...
    'total_meetings', total_meetings
  );
END;
```

```typescript
// In useAdminStats.ts
export interface AdminStats {
  ...
  totalMeetings: number;
}
```

### Track Edge Function Invocations

Call this from your edge functions to track usage:

```typescript
// In any edge function
await supabase.rpc('increment_edge_function_invocation', {
  function_name: 'my-function-name'
});
```

## Troubleshooting

### Stats Not Loading

1. **Check Admin Role**: Ensure your user has the admin role
```sql
SELECT * FROM user_roles WHERE user_id = auth.uid();
```

2. **Verify Function Exists**:
```sql
SELECT * FROM get_admin_stats();
```

3. **Check Browser Console**: Look for error messages

### Database Size Shows 0 MB

This can happen if:
- The SQL function doesn't have permissions to access `pg_database_size()`
- The fallback estimation is using empty tables

Solution: Run the SQL migration again or check table permissions.

### Edge Functions Count is 0

This means:
- The `edge_functions` table is empty
- No functions have `status = 'active'`

Solution: Insert your edge functions into the table (see Step 3).

### "Failed to load admin statistics" Error

Possible causes:
- Database connection issue
- RLS policies blocking access
- SQL function doesn't exist

Check:
1. Network connectivity to Supabase
2. Your admin role in `user_roles`
3. SQL function was created successfully

## Performance Considerations

### Caching Strategy

- **Client-side caching**: TanStack Query caches results for 30 seconds
- **Stale-while-revalidate**: Shows cached data while fetching updates
- **Automatic refetching**: Every 60 seconds in the background

### Database Impact

- All queries use indexed columns for performance
- SQL function combines multiple queries for efficiency
- `head: true` parameter used for count-only queries

### Optimization Tips

1. **Increase refresh interval** for less database load:
   ```typescript
   refetchInterval: 300000 // 5 minutes
   ```

2. **Add more indexes** if needed:
   ```sql
   CREATE INDEX idx_meetings_created_at ON meetings(created_at);
   ```

3. **Use materialized views** for very large databases:
   ```sql
   CREATE MATERIALIZED VIEW admin_stats_cache AS
   SELECT * FROM get_admin_stats();
   ```

## Security

### Row Level Security (RLS)

The `edge_functions` table has RLS policies that:
- Allow SELECT only for admin users
- Allow INSERT/UPDATE/DELETE only for admin users
- Check `user_roles` table for admin status

### SQL Function Security

The `get_admin_stats()` function:
- Uses `SECURITY DEFINER` to access system tables
- Only accessible to authenticated users
- Returns aggregated data (no sensitive info)

### Best Practices

1. ✅ Never expose raw database credentials
2. ✅ Always use RLS policies for admin tables
3. ✅ Log admin actions for audit trails
4. ✅ Validate admin role on both client and server
5. ✅ Use prepared statements to prevent SQL injection

## Future Enhancements

Potential additions to the admin dashboard:

1. **Historical Trends**: Store stats over time for charts
2. **Real-time Monitoring**: WebSocket updates for live stats
3. **Alerts**: Notifications when thresholds are exceeded
4. **Export**: Download stats as CSV/JSON
5. **Detailed Breakdowns**: Click-through to detailed views
6. **API Usage**: Track API endpoints and rate limits
7. **Error Logs**: Display recent errors and warnings
8. **Performance Metrics**: Response times, query durations

## Support

For issues or questions:
1. Check the console for error messages
2. Verify SQL function is properly created
3. Ensure you have admin role in database
4. Review RLS policies on relevant tables

## Related Files

- `src/pages/Admin.tsx` - Admin dashboard page
- `src/hooks/useAdminStats.ts` - Custom hook for fetching stats
- `create-admin-stats-function.sql` - Database migration
- `src/components/ui/skeleton.tsx` - Loading state component

---

**Version**: 1.0.0  
**Last Updated**: February 8, 2026  
**Author**: SJ Innovation Framework Team
