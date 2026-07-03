# OpenAI Integration - Quick Start Guide

Get your OpenAI integration running in 5 minutes! 🚀

## Prerequisites

- ✅ Admin access to the application
- ✅ OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))
- ✅ Access to Supabase dashboard or psql

## Step 1: Database Setup (2 minutes)

### Option A: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `create-integrations-table.sql` in your project
5. Copy all contents and paste into the query editor
6. Click **Run** (or press `Ctrl+Enter`)
7. Verify success: You should see "Success. No rows returned"

### Option B: Using Command Line

```bash
# Connect to your database
psql $DATABASE_URL -f create-integrations-table.sql
```

### Verify It Worked

Run this query in SQL Editor:

```sql
SELECT * FROM integration_settings;
```

You should see one row with `provider_name = 'openai'` and `is_active = false`.

## Step 2: Deploy Edge Function (1 minute)

```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the validation function
supabase functions deploy validate-api-key
```

**Success message:** You should see "Deployed Function validate-api-key"

## Step 3: Configure in Admin Panel (2 minutes)

1. **Open your app** and log in as an admin
   - URL: `http://localhost:5173` (dev) or your production URL

2. **Navigate to Integrations**
   - Click "Admin" in the sidebar
   - Click "Integrations" or go to `/admin/integrations`

3. **Add OpenAI Key**
   - You'll see the OpenAI integration card
   - Click in the "OpenAI API Key" field
   - Paste your API key (starts with `sk-proj-` or `sk-`)
   - Click **"Save API Key"**

4. **Test the Connection**
   - Click **"Test Connection"**
   - Wait for validation (takes 2-5 seconds)
   - You should see a green "Valid" badge ✅

5. **Enable the Integration**
   - Toggle the switch to **ON** (if not already)
   - The integration is now active!

## Step 4: Verify It's Working

### Test AI Chat

1. Go to `/ai` or `/ai/chat` in your app
2. Type a message like "Hello"
3. You should get an AI response
4. ✅ If you get a response, it's working!

### Test from Another Edge Function (Optional)

If you have other AI edge functions, update them:

```typescript
// Import the utility
import { getOpenAIApiKey } from '../_shared/integration-utils.ts';

// Inside your function handler
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const apiKey = await getOpenAIApiKey(supabaseUrl, supabaseServiceKey);

if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'OpenAI not configured' }),
    { status: 500 }
  );
}

// Use apiKey instead of Deno.env.get('OPENAI_API_KEY')
```

## ✅ Success Checklist

- [x] Database table created ✅
- [x] Edge function deployed ✅
- [x] API key added via admin panel ✅
- [x] Connection validated ✅
- [x] Integration enabled ✅
- [x] AI features working ✅

## 🎉 You're Done!

Your OpenAI integration is now configured and ready to use. The API key is:
- 🔒 Securely encrypted in the database
- 🔒 Only accessible to admins
- 🔒 Used automatically by all AI features

## What You Can Do Now

### Manage Your Integration

- **View Status**: Check the status badge (Valid/Invalid)
- **Update Key**: Click "Update" to change the API key
- **Test Anytime**: Click "Test Connection" to verify
- **Disable Temporarily**: Toggle the switch off
- **Remove**: Click the trash icon to delete (with confirmation)

### Monitor Usage

1. Go to `/admin/integrations/analytics`
2. View usage statistics and costs
3. Set up alerts for budget limits

### Add More Providers

The system is ready for:
- Anthropic (Claude)
- Google AI (Gemini)
- Perplexity
- Custom providers

## Troubleshooting

### "Table does not exist" Error

**Problem**: Database migration didn't run

**Solution**:
```sql
-- Run this in SQL Editor
SELECT * FROM information_schema.tables 
WHERE table_name = 'integration_settings';
```

If it returns no rows, run Step 1 again.

### "Permission denied" Error

**Problem**: You're not an admin

**Solution**:
```sql
-- Check your role
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- If needed, add admin role (replace with your user ID)
INSERT INTO user_roles (user_id, role_name)
VALUES ('YOUR_USER_ID', 'admin');
```

### "Failed to validate" Error

**Problem**: Edge function not deployed or API key invalid

**Solution**:
1. Check edge function: `supabase functions list`
2. View logs: `supabase functions logs validate-api-key`
3. Test API key manually at [OpenAI Playground](https://platform.openai.com/playground)

### AI Features Not Using New Key

**Problem**: Edge functions still using environment variables

**Solution**: Update your AI edge functions to use `getOpenAIApiKey()` utility (see Step 4 optional section)

## Pro Tips 💡

1. **Keep Env Vars as Backup**: Keep `OPENAI_API_KEY` in your environment variables as a fallback during transition

2. **Test in Dev First**: Set up in development before production

3. **Rotate Keys Regularly**: Update your API key every 90 days for security

4. **Monitor Costs**: Check OpenAI usage dashboard regularly

5. **Use Multiple Keys**: For high-volume apps, consider separate keys for dev/staging/prod

## Need Help?

- 📖 **Full Documentation**: See `INTEGRATION_SETTINGS_SETUP.md`
- 📊 **Implementation Details**: See `OPENAI_INTEGRATION_IMPLEMENTATION_SUMMARY.md`
- 🐛 **Issues**: Check edge function logs in Supabase dashboard
- 💬 **Support**: Check the troubleshooting section above

## Next Steps

Now that OpenAI is set up, you can:
1. Configure other AI providers (Anthropic, Google AI)
2. Set up usage alerts and monitoring
3. Customize AI agents in `/admin/ai-models`
4. Explore AI chat features at `/ai`

---

**Total Setup Time**: 5 minutes ⏱️  
**Difficulty**: Easy 🟢  
**Status**: Production Ready ✅
