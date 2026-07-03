# Fix Google OAuth Redirect to Localhost Issue

## Problem
When clicking Google sign-in, you're being redirected to `localhost:3000` instead of your production URL.

## Root Cause
Supabase Dashboard's **Site URL** and **Redirect URLs** are configured for localhost instead of your production domain.

---

## 🔧 Fix: Update Supabase Dashboard Settings

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq
2. Navigate to: **Authentication** → **URL Configuration**

### Step 2: Update Site URL

Find the **Site URL** field and update it to your production URL:

**Change from:**
```
http://localhost:3000
```

**Change to:**
```
https://controltower.collabai.software
```

### Step 3: Update Redirect URLs

Scroll down to **Redirect URLs** section and add BOTH:

```
https://controltower.collabai.software/auth/callback
http://localhost:8080/auth/callback
```

⚠️ **Important**: Keep localhost for local development, but add production URL for deployment.

### Step 4: Save Changes

Click **Save** at the bottom of the page.

---

## 🔍 Additional Configuration (If needed)

### Google Cloud Console

If you're still having issues, also check your Google OAuth configuration:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, ensure these are added:
   ```
   https://spppmtgzugvknfqeyjqq.supabase.co/auth/v1/callback
   ```

This is your Supabase OAuth callback URL that Google needs to know about.

---

## ✅ Verify the Fix

After making these changes:

1. **Clear browser cache** or use incognito mode
2. Go to your login page: `https://controltower.collabai.software/login`
3. Click **Sign in with Google**
4. You should now be redirected to your production URL, not localhost

---

## 🔄 For Local Development

If you want to test locally after this change:

1. Keep both URLs in Supabase Redirect URLs (production + localhost)
2. Access your local dev server at: `http://localhost:8080`
3. The code will automatically use the correct origin

---

## 📋 Quick Checklist

- [ ] Supabase Site URL updated to production URL
- [ ] Production redirect URL added: `https://controltower.collabai.software/auth/callback`
- [ ] Localhost redirect URL kept: `http://localhost:8080/auth/callback`
- [ ] Google Cloud Console has Supabase callback URL
- [ ] Changes saved in both dashboards
- [ ] Browser cache cleared
- [ ] Tested sign-in on production

---

## 🆘 Still Having Issues?

If Google sign-in still redirects to localhost:

1. **Check browser console** for errors
2. **Verify the callback URL** in the network tab (check the OAuth request)
3. **Confirm your Lovable deployment URL** matches what's configured
4. **Wait 5 minutes** after changing Supabase settings (cache may need to clear)
