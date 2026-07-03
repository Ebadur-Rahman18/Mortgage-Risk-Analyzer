# Debug: "Database error querying schema" Fix

## 🎯 Current Status

✅ **FIXED**: API key issue - requests are now reaching Supabase  
❌ **CURRENT ISSUE**: Database schema error - tables don't exist or demo users not created

## 📋 Step-by-Step Fix

### Step 1: Re-run the Updated Migration

The migration has been updated to include the missing `app_config` table.

1. **Open Supabase SQL Editor:**  
   https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/sql/new

2. **Copy and paste the ENTIRE `supabase-migration.sql` file**

3. **Click Run**

4. **Wait for success message**

### Step 2: Verify Tables Were Created

In the same SQL Editor, run the `verify-users.sql` script:

```sql
-- Check if tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'roles' THEN '✓ Role definitions'
    WHEN table_name = 'profiles' THEN '✓ User profiles'
    WHEN table_name = 'user_roles' THEN '✓ User role assignments'
    WHEN table_name = 'app_config' THEN '✓ Application configuration'
  END as description
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('roles', 'profiles', 'user_roles', 'app_config')
ORDER BY table_name;
```

**Expected result:** 4 rows (all 4 tables)

### Step 3: Create Demo Users via Dashboard

Since SQL user creation has issues, use the dashboard:

1. **Go to Auth Users:**  
   https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/auth/users

2. **Click "Add user" → "Create new user"**

3. **Create each user:**

   **Admin User:**
   - Email: `admin@collabai.software`
   - Password: `Admin@123`
   - Auto Confirm User: **✓ YES**
   - Click "Create user"
   - **COPY THE USER ID** (you'll need it)

   **Moderator User:**
   - Email: `moderator@collabai.software`
   - Password: `Moderator@123`
   - Auto Confirm User: **✓ YES**
   - Click "Create user"
   - **COPY THE USER ID**

   **Demo User:**
   - Email: `demo@collabai.software`
   - Password: `Demo@123`
   - Auto Confirm User: **✓ YES**
   - Click "Create user"
   - **COPY THE USER ID**

### Step 4: Assign Roles in SQL Editor

Go back to SQL Editor and run this (replace UUIDs with your actual user IDs):

```sql
-- Get the user IDs first (if you didn't copy them)
SELECT id, email FROM auth.users 
WHERE email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');

-- Then assign roles (the trigger should have created default 'user' role)
-- Update admin role
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@collabai.software');

-- Update moderator role  
UPDATE public.user_roles 
SET role = 'moderator' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'moderator@collabai.software');

-- Verify roles
SELECT u.email, ur.role 
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email IN ('admin@collabai.software', 'moderator@collabai.software', 'demo@collabai.software');
```

**Expected result:** 3 rows with correct roles

### Step 5: Test Login with Detailed Logging

1. **Restart your dev server:**
   ```bash
   # Stop (Ctrl+C)
   npm run dev
   ```

2. **Open browser console (F12 → Console tab)**

3. **Go to login page:** http://localhost:8080/login

4. **Enter credentials:**
   - Email: `admin@collabai.software`
   - Password: `Admin@123`

5. **Click Sign In**

6. **Watch the console** - you should see detailed logs:
   ```
   📝 [LOGIN PAGE] Form submitted
   📝 [LOGIN PAGE] Email: admin@collabai.software
   🔐 [AUTH] Starting sign in for: admin@collabai.software
   🔐 [AUTH] Calling supabase.auth.signInWithPassword...
   🔐 [AUTH] Supabase response: {...}
   ```

7. **Take a screenshot of ALL console output** and share it

## 🔍 What to Look For in Console

### ✅ Success looks like:
```
✅ [AUTH] Sign in successful!
✅ [LOGIN PAGE] Sign in successful, navigating to dashboard
```

### ❌ Failure will show:
```
❌ [AUTH] Sign in error: {
  message: "...",
  status: 400/500,
  code: "..."
}
```

The error details will tell us exactly what's wrong.

## 📊 Information Needed

After following all steps, please share:

1. ✅ or ❌ Did Step 2 show all 4 tables?
2. ✅ or ❌ Did Step 3 create all 3 users?
3. ✅ or ❌ Did Step 4 assign roles correctly?
4. 📸 Screenshot of console output from Step 5
5. 📸 Screenshot of any error messages

## 🎯 Quick Checklist

- [ ] Ran updated `supabase-migration.sql`
- [ ] Verified 4 tables exist (roles, profiles, user_roles, app_config)
- [ ] Created 3 users via Supabase dashboard
- [ ] All users have "confirmed" status
- [ ] Assigned roles via SQL
- [ ] Restarted dev server
- [ ] Opened browser console (F12)
- [ ] Attempted login and captured console output

## 💡 Common Issues

**Issue:** "User already exists" when creating in dashboard
- **Fix:** User was created previously, just copy their ID and assign role

**Issue:** "Cannot insert duplicate key" for user_roles
- **Fix:** Role already exists, use UPDATE instead of INSERT

**Issue:** Login still fails after all steps
- **Fix:** Share console output - the detailed logs will show the exact error

---

Follow these steps in order and share the results! 🚀
