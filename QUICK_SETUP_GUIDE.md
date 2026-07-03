# Quick Setup Guide - Create Demo Users in Lovable

Since you're using the same Lovable cloud database for both local and cloud deployments, follow these steps to create the demo users.

## Option 1: Create Users via Supabase Dashboard (RECOMMENDED - Easiest)

### Step 1: Go to Supabase Auth Dashboard

Visit: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/auth/users

### Step 2: Create Each User

Click **"Add user"** → **"Create new user"** and create these three users:

#### 👑 Admin User
- **Email:** `admin@collabai.software`
- **Password:** `Admin@123`
- **Auto Confirm User:** ✅ **YES** (Important!)
- **Send Email Invitation:** ❌ No

#### 🛡️ Moderator User
- **Email:** `moderator@collabai.software`
- **Password:** `Moderator@123`
- **Auto Confirm User:** ✅ **YES** (Important!)
- **Send Email Invitation:** ❌ No

#### 👤 Demo User
- **Email:** `demo@collabai.software`
- **Password:** `Demo@123`
- **Auto Confirm User:** ✅ **YES** (Important!)
- **Send Email Invitation:** ❌ No

### Step 3: Assign Roles and Create Profiles

After creating all three users, go to SQL Editor:

Visit: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/sql/new

Copy and paste this SQL:

```sql
-- Assign roles and create profiles for demo users
DO $$
DECLARE
  v_admin_id UUID;
  v_moderator_id UUID;
  v_user_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@collabai.software';
  SELECT id INTO v_moderator_id FROM auth.users WHERE email = 'moderator@collabai.software';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@collabai.software';

  -- Admin Profile & Role
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, updated_at)
    VALUES (v_admin_id, 'admin@collabai.software', 'Admin User', NOW())
    ON CONFLICT (id) DO UPDATE SET full_name = 'Admin User', updated_at = NOW();
    
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (v_admin_id, 'admin', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Moderator Profile & Role
  IF v_moderator_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, updated_at)
    VALUES (v_moderator_id, 'moderator@collabai.software', 'Moderator User', NOW())
    ON CONFLICT (id) DO UPDATE SET full_name = 'Moderator User', updated_at = NOW();
    
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (v_moderator_id, 'moderator', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Demo User Profile & Role
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, updated_at)
    VALUES (v_user_id, 'demo@collabai.software', 'Demo User', NOW())
    ON CONFLICT (id) DO UPDATE SET full_name = 'Demo User', updated_at = NOW();
    
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (v_user_id, 'user', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

END $$;
```

Click **"Run"** to execute.

### Step 4: Verify Setup

Run this SQL to verify everything is set up correctly:

```sql
-- Verify all demo users are properly configured
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as confirmed,
  p.full_name,
  p.department,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email IN (
  'admin@collabai.software',
  'moderator@collabai.software',
  'demo@collabai.software'
)
ORDER BY ur.role;
```

You should see 3 rows with:
- ✅ All emails confirmed
- ✅ Full names assigned
- ✅ Roles assigned (admin, moderator, user)

### Step 5: Test Login

1. Start your local dev server: `npm run dev`
2. Go to: http://localhost:8080/login
3. Click any demo credential button to auto-fill
4. Click "Sign in"
5. You should be redirected to the dashboard! 🎉

---

## Option 2: Use SQL Only (Advanced)

If you prefer to use pure SQL, you can use the Supabase Admin API functions. However, **Option 1 is recommended** as it's simpler and less error-prone.

Visit: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/sql/new

Run the migration file: `supabase/migrations/20260204_create_demo_users.sql`

---

## Troubleshooting

### ❌ "Invalid login credentials" Error

**Causes:**
1. Users not created yet → Complete Step 2 above
2. Email not confirmed → Make sure "Auto Confirm User" was checked
3. Wrong password → Passwords are case-sensitive (Admin@123, not admin@123)

**Solution:**
- Go to Auth Users in Supabase dashboard
- Find the user
- Click on the user
- Check if "Email Confirmed" is YES
- If not, click "Send magic link" or manually confirm

### ❌ Users exist but roles not showing

**Solution:**
Run the SQL from Step 3 again to assign roles.

### ❌ Can't access admin pages

**Cause:** Role not properly assigned in `user_roles` table

**Solution:**
```sql
-- Check current roles
SELECT u.email, ur.role 
FROM auth.users u 
LEFT JOIN user_roles ur ON ur.user_id = u.id 
WHERE u.email = 'admin@collabai.software';

-- If role is missing or wrong, fix it:
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@collabai.software'
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## Summary: What You Get

After setup, you can login with these credentials:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| 👑 Admin | admin@collabai.software | Admin@123 | Full admin access |
| 🛡️ Moderator | moderator@collabai.software | Moderator@123 | Moderate users/content |
| 👤 User | demo@collabai.software | Demo@123 | Standard user access |

**Note:** These credentials work on both:
- 🌐 Lovable cloud deployment
- 💻 Your local development environment

Since you're using the same Lovable Supabase database for both!

---

## Security Notes

⚠️ **Important:**
- These are demo accounts for testing only
- Change passwords before going to production
- Consider deleting these accounts in production
- Never share your Supabase service role key

---

**Last Updated:** 2026-02-04  
**Lovable Project ID:** pgxezxqrlooymhczomen
