# Quick Migration Guide - 2 Simple Steps

## ✅ Step 1: Run Schema Migration (2 minutes)

### 1.1 Open Supabase SQL Editor
Go to: **https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/sql/new**

### 1.2 Copy and Run the Schema Migration
1. Open the file: `supabase-migration.sql`
2. Copy **ALL** content (Ctrl+A, then Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **"Run"** button (or Ctrl+Enter)
5. Wait for "Success" message

### 1.3 Verify Schema Created
Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('roles', 'profiles', 'user_roles');
```

You should see 3 tables listed.

---

## ✅ Step 2: Create Demo Users (Choose One Method)

### 🎯 Method A: Using Supabase Dashboard (Easiest - Recommended)

**Go to:** https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/auth/users

#### Create Admin User:
1. Click **"Add user"** → **"Create new user"**
2. Enter:
   - Email: `admin@collabai.software`
   - Password: `Admin@123`
   - Auto Confirm User: **✓ YES**
3. Click **"Create user"**
4. Copy the User ID (UUID) that appears

#### Create Moderator User:
1. Click **"Add user"** → **"Create new user"**
2. Enter:
   - Email: `moderator@collabai.software`
   - Password: `Moderator@123`
   - Auto Confirm User: **✓ YES**
3. Click **"Create user"**
4. Copy the User ID (UUID) that appears

#### Create Demo User:
1. Click **"Add user"** → **"Create new user"**
2. Enter:
   - Email: `demo@collabai.software`
   - Password: `Demo@123`
   - Auto Confirm User: **✓ YES**
3. Click **"Create user"**
4. Copy the User ID (UUID) that appears

#### Assign Roles:
Go back to SQL Editor and run this (replace the UUIDs with your actual user IDs):

```sql
-- Assign Admin Role
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = 'PASTE_ADMIN_USER_ID_HERE';

-- Assign Moderator Role
UPDATE public.user_roles 
SET role = 'moderator' 
WHERE user_id = 'PASTE_MODERATOR_USER_ID_HERE';

-- User role is already set by default (no action needed)

-- Verify roles assigned
SELECT u.email, ur.role 
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY ur.role;
```

---

### 🎯 Method B: Using Node.js Script (Alternative)

If you have Node.js installed:

1. Make sure your `.env` file has the service role key:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. Get your service role key from:
   https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/settings/api

3. Run the setup script:
   ```bash
   npm run setup:demo-users
   ```

---

### 🎯 Method C: Using SQL Script (Advanced)

If the dashboard method doesn't work, try:

1. Open: `create-demo-users.sql`
2. Copy all content
3. Paste in Supabase SQL Editor
4. Run the script

**Note:** This method may fail due to auth schema permissions. If it fails, use Method A instead.

---

## ✅ Step 3: Test Login

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:8080/login

3. Try logging in with:
   - **Admin:** admin@collabai.software / Admin@123
   - **Moderator:** moderator@collabai.software / Moderator@123
   - **User:** demo@collabai.software / Demo@123

---

## 🔍 Troubleshooting

### "Invalid login credentials" error

**Check 1:** Are users created?
```sql
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');
```

**Check 2:** Are profiles created?
```sql
SELECT p.email, p.full_name 
FROM public.profiles p
WHERE p.email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');
```

**Check 3:** Are roles assigned?
```sql
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');
```

**Fix:** If any checks fail, manually create missing records:

```sql
-- If profile is missing (replace USER_ID):
INSERT INTO public.profiles (id, email, full_name)
VALUES ('USER_ID', 'admin@collabai.software', 'Admin User');

-- If role is missing (replace USER_ID):
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID', 'admin');
```

### "Schema error" when running migration

This usually means:
1. Tables already exist → **Safe to ignore** if using `IF NOT EXISTS`
2. Permission issue → Make sure you're running in SQL Editor as owner

**Solution:** Clear and retry:
```sql
-- Only if you want to start fresh:
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- Then re-run the migration
```

---

## 📋 Quick Reference

| What | URL |
|------|-----|
| SQL Editor | https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/sql/new |
| Auth Users | https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/auth/users |
| API Keys | https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/settings/api |
| Logs | https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/logs/postgres-logs |

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@collabai.software | Admin@123 | admin |
| Moderator | moderator@collabai.software | Moderator@123 | moderator |
| User | demo@collabai.software | Demo@123 | user |

---

**That's it! You should now be able to log in with all three demo users.** 🎉
