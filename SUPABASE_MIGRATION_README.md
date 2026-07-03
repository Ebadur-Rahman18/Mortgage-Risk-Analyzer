# Supabase Migration Guide

Complete database setup for Control Tower Mortgage Base with roles and demo users.

## What This Migration Does

This migration script will:

1. ✅ Create the `app_role` enum type with three roles: `admin`, `moderator`, `user`
2. ✅ Create the `roles` table with role definitions and permissions
3. ✅ Create the `profiles` table for user profile data
4. ✅ Create the `user_roles` table to link users with their roles
5. ✅ Set up Row Level Security (RLS) policies for all tables
6. ✅ Create helper functions (e.g., `has_role()`)
7. ✅ Create database triggers for automatic timestamp updates
8. ✅ Create three demo users with email/password authentication
9. ✅ Link demo users to profiles and assign roles

## Demo Users Created

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| 👑 **Admin** | admin@collabai.software | Admin@123 | Full system access |
| 🛡️ **Moderator** | moderator@collabai.software | Moderator@123 | Content management |
| 👤 **User** | demo@collabai.software | Demo@123 | Basic user access |

## How to Run the Migration

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq
2. Click on **SQL Editor** in the left sidebar
3. Click **New query** button

### Step 2: Copy and Paste the Migration

1. Open the file: `supabase-migration.sql`
2. Copy **ALL** the content (Ctrl+A, then Ctrl+C)
3. Paste it into the Supabase SQL Editor
4. Click **Run** button (or press Ctrl+Enter)

### Step 3: Wait for Completion

The script will execute and show you:
- ✅ Success messages for each step
- ✅ NOTICE messages confirming user creation
- ✅ Any errors if something went wrong (unlikely)

### Step 4: Verify the Migration

Run these verification queries in the SQL Editor:

```sql
-- Check if users were created
SELECT email, raw_user_meta_data->>'full_name' as full_name, email_confirmed_at
FROM auth.users
WHERE email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');

-- Check profiles and roles
SELECT p.email, p.full_name, ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');

-- Check role definitions
SELECT name, slug, description, display_order
FROM public.roles
ORDER BY display_order;
```

Expected results:
- 3 users in auth.users with confirmed emails
- 3 profiles with corresponding roles
- 3 role definitions (Admin, Moderator, User)

## Test Login

After running the migration:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:8080/login

3. Try logging in with each demo account:
   - **Admin:** admin@collabai.software / Admin@123
   - **Moderator:** moderator@collabai.software / Moderator@123
   - **User:** demo@collabai.software / Demo@123

## Troubleshooting

### Error: "relation already exists"

This is normal if you've run the migration before. The script uses `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT` clauses, so it's safe to run multiple times.

### Error: "duplicate key value violates unique constraint"

This means the users already exist. The script will update existing users instead of creating new ones.

### Can't log in with demo users

**Possible causes:**

1. **Email not confirmed** - Check the verification query above to ensure `email_confirmed_at` is set
2. **Wrong password** - Passwords are case-sensitive
3. **RLS policies blocking** - Check the Supabase logs for policy violations

**Solutions:**

```sql
-- Force confirm email for a user
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'admin@collabai.software';

-- Reset password for a user (run in SQL Editor)
UPDATE auth.users
SET encrypted_password = crypt('Admin@123', gen_salt('bf'))
WHERE email = 'admin@collabai.software';
```

### Users created but can't see their role

Check if the role was assigned:

```sql
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'admin@collabai.software';
```

If role is NULL, manually assign it:

```sql
-- Get the user ID first
SELECT id, email FROM auth.users WHERE email = 'admin@collabai.software';

-- Then assign the role (replace USER_ID_HERE with actual UUID)
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

## Database Schema

### Tables Created

1. **`public.roles`** - Role definitions with permissions
   - `id` (UUID, PK)
   - `name` (TEXT) - Display name
   - `slug` (TEXT) - Unique identifier (admin, moderator, user)
   - `description` (TEXT)
   - `permissions` (JSONB) - Role permissions
   - `is_system` (BOOLEAN) - System-defined role
   - `display_order` (INTEGER)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **`public.profiles`** - User profile information
   - `id` (UUID, PK, FK to auth.users)
   - `email` (TEXT)
   - `full_name` (TEXT)
   - `avatar_url` (TEXT)
   - `is_active` (BOOLEAN)
   - `deactivated_at`, `deactivated_by` (UUID)
   - `metadata` (JSONB)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

3. **`public.user_roles`** - Links users to roles
   - `id` (UUID, PK)
   - `user_id` (UUID, FK to auth.users, UNIQUE)
   - `role` (app_role enum)
   - `created_at` (TIMESTAMPTZ)

### Enum Types

- **`app_role`** - Enum with values: `admin`, `moderator`, `user`

### Functions

- **`public.has_role(_role app_role, _user_id UUID)`** - Check if user has a specific role

### RLS Policies

All tables have Row Level Security enabled with appropriate policies:

- Users can view/update their own profile
- Admins can view/update all profiles
- Users can view their own role
- Admins can manage all roles
- Everyone can view role definitions

## Security Notes

⚠️ **Important Security Considerations:**

1. **Change default passwords** - These demo passwords should be changed in production
2. **Never commit passwords** - Don't commit this migration to public repositories with these passwords
3. **Service role key** - Keep your Supabase service role key secret
4. **RLS policies** - Always test RLS policies to ensure proper data isolation
5. **Production users** - Create proper users with strong passwords for production

## Next Steps

After successful migration:

1. ✅ Test login with all three demo users
2. ✅ Verify role-based access control works
3. ✅ Create your production users (don't use demo credentials)
4. ✅ Set up additional tables as needed (clients, tasks, meetings, etc.)
5. ✅ Configure your .env file with correct Supabase credentials

## Support

If you encounter issues:

1. Check the Supabase logs: Dashboard → Logs → Postgres Logs
2. Verify your Supabase project ID in `.env` matches your dashboard
3. Ensure you're using the correct Supabase URL and keys
4. Review the RLS policies if you can't access data

## Re-running the Migration

It's safe to re-run this migration multiple times. The script uses:
- `CREATE TABLE IF NOT EXISTS` - Won't fail if table exists
- `ON CONFLICT DO UPDATE` - Will update existing records
- `DO $$ ... END $$` blocks - Will check for existing users before creating

To completely reset and start fresh:

```sql
-- ⚠️ WARNING: This will delete all data!
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- Then re-run the migration script
```

---

**Last Updated:** 2026-02-04  
**Version:** 1.0  
**Compatible With:** Supabase PostgreSQL 14.1+
