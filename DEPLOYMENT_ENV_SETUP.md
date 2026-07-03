# Environment Variables Setup for Deployment

## Overview
This guide explains how to configure environment variables for your deployment platform.

## Environment Variables Needed

### Microsoft Auth Configuration
```bash
VITE_MICROSOFT_CLIENT_ID="45aa78d3-5407-4805-951e-ba314fd8a029"
VITE_MICROSOFT_DIRECTORY_ID="116ff123-e110-4e76-b24b-08476dabce8a"
VITE_MICROSOFT_LOGOUT_URI="http://localhost:8080/login"
VITE_MICROSOFT_REDIRECT_URI="https://controltower.collabai.software"
```

### Supabase Configuration
```bash
VITE_SUPABASE_PROJECT_ID="spppmtgzugvknfqeyjqq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcHBtdGd6dWd2a25mcWV5anFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDM3NTMsImV4cCI6MjA4NTc3OTc1M30.71_tp6DUka0REiaaAZ25Fnc4tVUaEuOM6Hyuhajs1o4"
VITE_SUPABASE_URL="https://spppmtgzugvknfqeyjqq.supabase.co"
```

### Service Role Key (Server-side only)
```bash
SUPABASE_SERVICE_ROLE_KEY="<your-actual-service-role-key>"
```
⚠️ **IMPORTANT**: Replace with your actual service role key from Supabase Dashboard → Settings → API

---

## Platform-Specific Setup Instructions

### Vercel
1. Go to your project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable above with its value
4. Select environments: Production, Preview, Development
5. Click **Save**
6. Redeploy your application

### Netlify
1. Go to **Site settings** → **Environment variables**
2. Click **Add a variable**
3. Add each variable from the list above
4. Click **Save**
5. Trigger a new deploy

### GitHub Pages (with GitHub Actions)
Add to your repository secrets:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each variable
4. Update your workflow file to use these secrets

### Railway
1. Go to your project
2. Click **Variables** tab
3. Add each variable
4. Deploy will automatically restart

### Render
1. Go to your service dashboard
2. Navigate to **Environment**
3. Add each variable
4. Click **Save Changes**

### Docker/Self-hosted
Create a `.env` file on your server (NOT in git):
```bash
# Copy .env.example to .env on the server
cp .env.example .env

# Edit with your actual values
nano .env
```

Or pass as Docker environment variables:
```bash
docker run -e VITE_SUPABASE_URL="..." -e VITE_SUPABASE_PUBLISHABLE_KEY="..." ...
```

---

## Security Notes

✅ **Safe to expose publicly** (client-side):
- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_DIRECTORY_ID`
- `VITE_MICROSOFT_REDIRECT_URI`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (designed to be public)
- `VITE_SUPABASE_URL`

❌ **NEVER expose publicly** (server-side only):
- `SUPABASE_SERVICE_ROLE_KEY` - This key bypasses Row Level Security!

---

## Verification

After setting up environment variables, verify they're loaded:
1. Visit: `https://your-domain.com/env-debug`
2. Check that all variables show as "Loaded"
3. If any show as "Missing", recheck your platform configuration

---

## Troubleshooting

### Variables not loading?
1. **Restart/Redeploy** after adding variables
2. **Check variable names** - they're case-sensitive
3. **Vite requirement**: Variables must start with `VITE_` to be available client-side
4. **Clear cache** in your deployment platform

### Still seeing empty page?
1. Check browser console for errors
2. Verify Supabase URL is accessible: `https://spppmtgzugvknfqeyjqq.supabase.co`
3. Check that the publishable key is correct in Supabase Dashboard → Settings → API

---

## Local Development

For local development:
1. Copy `.env.example` to `.env`
2. Fill in any missing values
3. Never commit `.env` to git
