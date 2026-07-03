# Fix: "No API key found in request" Error

## 🔴 The Problem

You're seeing this error:
```json
{
  "message": "No API key found in request",
  "hint": "No `apikey` request header or url param was found."
}
```

When the app tries to hit: `https://spppmtgzugvknfqeyjqq.supabase.co/auth/v1/token?grant_type=password`

## ✅ The Solution

This means your Supabase environment variables are not being loaded by Vite. Here's how to fix it:

### Step 1: Verify Your .env File

Your `.env` file should look like this:

```bash
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="spppmtgzugvknfqeyjqq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcHBtdGd6dWd2a25mcWV5anFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDM3NTMsImV4cCI6MjA4NTc3OTc1M30.71_tp6DUka0REiaaAZ25Fnc4tVUaEuOM6Hyuhajs1o4"
VITE_SUPABASE_URL="https://spppmtgzugvknfqeyjqq.supabase.co"
```

**Important:**
- ✅ Variables MUST start with `VITE_` prefix
- ✅ File MUST be named `.env` (not `.env.local` or `.env.production`)
- ✅ File MUST be in the project root (same folder as `package.json`)
- ✅ No spaces around the `=` sign
- ✅ Values can be with or without quotes (both work)

### Step 2: Restart Your Dev Server

**This is the most important step!** Vite only reads `.env` files when the dev server starts.

1. **Stop your current dev server:**
   - Press `Ctrl+C` in the terminal

2. **Start it again:**
   ```bash
   npm run dev
   ```

3. **Wait for it to fully start:**
   ```
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:8080/
   ```

### Step 3: Verify Environment Variables Are Loaded

I've created a debug page to help you check. After restarting:

1. Open your browser and go to: **http://localhost:8080/env-debug**

2. You should see:
   - ✅ **Supabase Configuration: OK** (green box)
   - ✅ All variables showing as "Set"

3. If you see ❌ **Supabase Configuration: MISSING** (red box):
   - Double-check your `.env` file
   - Make sure it's in the root directory
   - Restart the dev server again

### Step 4: Test Login

1. Go to: http://localhost:8080/login
2. Try logging in with: `admin@collabai.software` / `Admin@123`
3. The error should be gone!

## 🔍 Additional Troubleshooting

### Problem: Still getting "No API key" error after restart

**Check 1: Is .env in the right location?**
```bash
# Run this in your project root
ls -la .env
# or on Windows
dir .env
```

You should see the file. If not, create it in the project root.

**Check 2: Are the variable names correct?**

Open `.env` and verify:
- ✅ `VITE_SUPABASE_URL` (not `SUPABASE_URL`)
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` (not `SUPABASE_KEY` or `VITE_SUPABASE_KEY`)

**Check 3: Check browser console**

Open browser DevTools (F12) → Console tab, look for:
```
Supabase configuration error:
VITE_SUPABASE_URL: undefined
```

If you see this, the variables are definitely not loading.

### Problem: .env file exists but variables not loading

**Solution 1: Clear Vite cache**
```bash
# Stop the dev server
# Delete the cache folder
rm -rf node_modules/.vite
# or on Windows
rmdir /s node_modules\.vite

# Restart dev server
npm run dev
```

**Solution 2: Check .gitignore**

Make sure `.env` is NOT being ignored by your IDE or terminal:
```bash
cat .env
# Should show your environment variables
```

**Solution 3: Try .env.local instead**

If `.env` still doesn't work, try:
1. Rename `.env` to `.env.local`
2. Restart dev server
3. Check `/env-debug` page again

### Problem: Variables load in dev but not in production

For production deployment, you need to set environment variables in your hosting platform:

**Vercel:**
- Go to Project Settings → Environment Variables
- Add each `VITE_*` variable

**Netlify:**
- Go to Site Settings → Environment Variables
- Add each `VITE_*` variable

**Other platforms:**
- Check their documentation for environment variable configuration

## 📝 Summary Checklist

- [ ] `.env` file exists in project root
- [ ] Variables start with `VITE_` prefix
- [ ] `VITE_SUPABASE_URL` is set
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` is set
- [ ] Dev server has been restarted
- [ ] Visited `/env-debug` page shows green "OK"
- [ ] Login page no longer shows API key error

## 🎯 Quick Test Commands

Run these to verify everything:

```bash
# 1. Check .env exists
cat .env | grep VITE_SUPABASE

# 2. Restart dev server (stop with Ctrl+C first)
npm run dev

# 3. Open debug page
# Go to: http://localhost:8080/env-debug

# 4. Test login
# Go to: http://localhost:8080/login
# Try: admin@collabai.software / Admin@123
```

## ❓ Still Having Issues?

If you've tried everything above and it's still not working:

1. **Check the browser console** (F12 → Console) for any error messages
2. **Check the terminal** where dev server is running for any warnings
3. **Verify your Supabase project** is active at: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq
4. **Try the API key directly** in Postman/curl to verify it works

Example curl test:
```bash
curl -X POST 'https://spppmtgzugvknfqeyjqq.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR_PUBLISHABLE_KEY_HERE' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@collabai.software",
    "password": "Admin@123"
  }'
```

If this curl works but the app doesn't, it's definitely an env variable loading issue.

---

**Last Updated:** 2026-02-04  
**Issue:** No API key found in request  
**Cause:** Environment variables not loaded by Vite  
**Fix:** Restart dev server after .env changes
