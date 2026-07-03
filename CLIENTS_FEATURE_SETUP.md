# Clients Feature Setup Guide

## Overview
This guide helps you set up the Clients management feature by creating the required database table.

## Prerequisites
- Supabase project: `spppmtgzugvknfqeyjqq`
- Admin access to Supabase Dashboard

---

## Step 1: Run the Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq
   - Click **SQL Editor** in the left sidebar
   - Click **New query**

2. **Copy the Migration Script**
   - Open the file: `create-clients-table.sql`
   - Copy the entire contents

3. **Run the Migration**
   - Paste the SQL into the editor
   - Click **Run** button (or press Ctrl/Cmd + Enter)
   - Wait for success message: "Success. No rows returned"

4. **Verify the Migration**
   - Scroll down in the same SQL editor
   - You'll see verification queries at the bottom
   - Run them individually to confirm:
     - Table exists ✅
     - Columns are correct ✅
     - Indexes created ✅
     - RLS policies active ✅

### Option B: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push --file create-clients-table.sql
```

---

## Step 2: Verify the Feature Works

1. **Commit and Push Code Changes**
   ```bash
   git add .
   git commit -m "Add clients table migration and implement client management"
   git push origin main
   ```

2. **Wait for Deployment**
   - Lovable will automatically deploy the changes
   - Wait 1-2 minutes for deployment to complete

3. **Test the Feature**
   - Log in to your app: https://mortgage.collabai.software
   - Navigate to **Clients** page
   - Click **Add Client** button
   - Fill in client information:
     - Name: "Test Client" (required)
     - Email: "test@example.com"
     - Company: "Test Corp"
     - Phone: "+1 555-1234"
     - Notes: "This is a test client"
   - Click **Create Client**
   - Should see success message: "Client created successfully"

4. **Test Other Features**
   - View clients list
   - Search for clients
   - Edit a client
   - Delete a client

---

## Database Schema

### Table: `public.clients`

| Column       | Type      | Nullable | Default              | Description                           |
|------------- |---------- |--------- |--------------------- |-------------------------------------- |
| id           | UUID      | No       | gen_random_uuid()    | Primary key                           |
| name         | TEXT      | No       | -                    | Client name or business name          |
| email        | TEXT      | Yes      | NULL                 | Client email address                  |
| company      | TEXT      | Yes      | NULL                 | Client company name                   |
| phone        | TEXT      | Yes      | NULL                 | Client phone number                   |
| status       | TEXT      | Yes      | 'active'             | Client status (active/inactive)       |
| metadata     | JSONB     | Yes      | '{}'                 | Additional data (e.g., notes)         |
| created_by   | UUID      | Yes      | NULL                 | User who created the client           |
| created_at   | TIMESTAMP | Yes      | now()                | Creation timestamp                    |
| updated_at   | TIMESTAMP | Yes      | now()                | Last update timestamp                 |

### Indexes
- `idx_clients_name` - Fast name lookups
- `idx_clients_email` - Fast email lookups
- `idx_clients_company` - Fast company lookups
- `idx_clients_search` - Full-text search on name, email, company
- `idx_clients_created_by` - Filter by creator
- `idx_clients_status` - Filter by status
- `idx_clients_created_at` - Sort by creation date

### Row Level Security (RLS) Policies

1. **View Clients**: All authenticated users can view all clients
2. **Create Clients**: All authenticated users can create clients
3. **Update Clients**: Users can update their own clients OR admins can update all
4. **Delete Clients**: Users can delete their own clients OR admins can delete all

---

## Troubleshooting

### Error: "clients table not yet created"
**Solution**: Run the migration script in Supabase SQL Editor (see Step 1)

### Error: "permission denied for table clients"
**Solution**: Check RLS policies are created correctly. Re-run the migration script.

### Error: "relation 'public.clients' does not exist"
**Solution**: The table wasn't created. Run the migration script again.

### Clients not showing in the list
**Solution**: 
1. Check browser console for errors
2. Verify RLS policies allow SELECT for authenticated users
3. Try logging out and back in

### Can't create clients
**Solution**:
1. Check you're logged in as an authenticated user
2. Verify RLS INSERT policy exists
3. Check browser console for specific error messages

---

## What Changed in the Code

### Files Modified:
1. **`src/hooks/useClients.ts`** - Implemented actual Supabase queries instead of placeholders
2. **`create-clients-table.sql`** - New migration script for database setup
3. **`CLIENTS_FEATURE_SETUP.md`** - This guide

### Files Already Existing:
- `src/pages/Clients.tsx` - Clients list page
- `src/pages/ClientForm.tsx` - Create/Edit client form
- `src/pages/ClientDetail.tsx` - View single client details
- `src/lib/validation.ts` - Client form validation schema

---

## Next Steps

After clients feature is working, you may want to:

1. **Add more features**:
   - Client documents upload
   - Client activity timeline
   - Client tags/categories
   - Client financial information

2. **Integrate with other features**:
   - Link clients to mortgage applications
   - Link clients to tasks
   - Link clients to meetings

3. **Add more fields**:
   - Address
   - Date of birth
   - Occupation
   - Income information
   - Credit score

---

## Need Help?

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Check browser console for JavaScript errors
3. Verify you ran the complete migration script
4. Ensure you're logged in as an authenticated user
