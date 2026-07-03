# Setup Demo Users for Local Development

This guide will help you create demo users in your local Supabase instance so you can test the login functionality.

## Prerequisites

1. You have cloned the repository locally
2. You have a Supabase project (connected to Lovable or your own instance)
3. You have the Supabase Service Role Key

## Quick Setup

### Step 1: Get Your Supabase Service Role Key

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/settings/api
2. Copy the **Service Role Key** (⚠️ Keep this secret!)
3. Add it to your `.env` file:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key-here
```

### Step 2: Install tsx (if not already installed)

```bash
npm install -D tsx
```

### Step 3: Run the Setup Script

```bash
npm run setup:demo-users
```

This will create three demo users:

| Role | Email | Password | Department |
|------|-------|----------|------------|
| 👑 **Admin** | admin@collabai.software | Admin@123 | Management |
| 🛡️ **Moderator** | moderator@collabai.software | Moderator@123 | Operations |
| 👤 **User** | demo@collabai.software | Demo@123 | Sales |

### Step 4: Test Login

1. Start your development server: `npm run dev`
2. Navigate to http://localhost:8080/login
3. Click any of the demo credentials to auto-fill the form
4. Click "Sign in"

## Manual Setup (Alternative Method)

If you prefer to create users manually through Supabase dashboard:

### Method 1: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/auth/users
2. Click "Add user" → "Create new user"
3. Create each user with these details:

**Admin User:**
- Email: `admin@collabai.software`
- Password: `Admin@123`
- Confirm: Yes
- Send Email: No

**Moderator User:**
- Email: `moderator@collabai.software`
- Password: `Moderator@123`
- Confirm: Yes
- Send Email: No

**Demo User:**
- Email: `demo@collabai.software`
- Password: `Demo@123`
- Confirm: Yes
- Send Email: No

### Method 2: Using SQL Editor

1. Go to: https://supabase.com/dashboard/project/pgxezxqrlooymhczomen/sql/new
2. Run this SQL for each user (replace email/password):

```sql
-- Create admin user
SELECT auth.create_user(
  jsonb_build_object(
    'email', 'admin@collabai.software',
    'password', 'Admin@123',
    'email_confirm', true,
    'user_metadata', jsonb_build_object('full_name', 'Admin User')
  )
);

-- Create moderator user
SELECT auth.create_user(
  jsonb_build_object(
    'email', 'moderator@collabai.software',
    'password', 'Moderator@123',
    'email_confirm', true,
    'user_metadata', jsonb_build_object('full_name', 'Moderator User')
  )
);

-- Create demo user
SELECT auth.create_user(
  jsonb_build_object(
    'email', 'demo@collabai.software',
    'password', 'Demo@123',
    'email_confirm', true,
    'user_metadata', jsonb_build_object('full_name', 'Demo User')
  )
);
```

### Method 3: Assign Roles After User Creation

After creating users (by any method), assign roles:

1. Get the user IDs from the auth.users table
2. Run this SQL in Supabase SQL Editor:

```sql
-- Get user IDs first
SELECT id, email FROM auth.users WHERE email IN (
  'admin@collabai.software',
  'moderator@collabai.software',
  'demo@collabai.software'
);

-- Then assign roles (replace the UUIDs with actual user IDs)
INSERT INTO user_roles (user_id, role) VALUES
  ('admin-user-id-here', 'admin'),
  ('moderator-user-id-here', 'moderator'),
  ('demo-user-id-here', 'user')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
```

## Troubleshooting

### Error: "Invalid login credentials"

**Possible causes:**
1. Users haven't been created yet - Run the setup script
2. Email confirmation required - Make sure `email_confirm: true` was set
3. Wrong password - Passwords are case-sensitive
4. RLS policies blocking access - Check Supabase logs

### Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required"

**Solution:**
Add the service role key to your `.env` file (see Step 1 above)

### Error: "User already exists"

**Solution:**
The script will update existing users. This is expected and safe.

### Script runs but can't login

**Solution:**
1. Check if users were created in Supabase dashboard
2. Verify email confirmation status
3. Check if roles were assigned in `user_roles` table
4. Try resetting password through Supabase dashboard

## Verifying Setup

After running the setup script, verify in Supabase dashboard:

1. **Check Users Created:**
   - Go to: Authentication → Users
   - You should see 3 users with confirmed emails

2. **Check Profiles Created:**
   ```sql
   SELECT id, email, full_name, department FROM profiles;
   ```

3. **Check Roles Assigned:**
   ```sql
   SELECT u.email, ur.role 
   FROM user_roles ur 
   JOIN auth.users u ON u.id = ur.user_id;
   ```

## Security Notes

⚠️ **Important:**
- Never commit your `SUPABASE_SERVICE_ROLE_KEY` to git
- These are demo accounts - change passwords in production
- The service role key has full admin access - keep it secure
- Consider using different credentials for production

## Support

If you encounter issues:
1. Check the [Supabase documentation](https://supabase.com/docs/guides/auth)
2. Review the setup script logs for errors
3. Check Supabase dashboard logs
4. Verify your `.env` configuration matches the project

---

**Last Updated:** 2026-02-04
**Compatible With:** SJ Innovation Framework V1
