# Integration Settings Setup Guide

## Overview

This guide explains how to set up and use the new Integration Settings feature that allows admins to configure API keys through the UI instead of environment variables.

## Features

✅ **Secure API Key Storage** - API keys are encrypted and stored in the database  
✅ **Admin UI** - Easy-to-use interface at `/admin/integrations`  
✅ **Validation** - Test API keys before saving  
✅ **Multi-Provider Support** - OpenAI, Anthropic, and more  
✅ **Fallback Support** - Falls back to environment variables if not configured  
✅ **Enable/Disable** - Toggle integrations on/off without deleting keys  

## Database Setup

### Step 1: Run the Migration

Execute the SQL migration to create the `integration_settings` table:

```bash
# Connect to your Supabase database and run:
psql $DATABASE_URL -f create-integrations-table.sql
```

Or in Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `create-integrations-table.sql`
3. Run the query

### Step 2: Verify Table Creation

Check that the table was created:

```sql
SELECT * FROM integration_settings;
```

You should see the default OpenAI entry with `is_active = false`.

## Edge Functions Setup

### Step 1: Deploy the Validation Function

Deploy the validate-api-key edge function:

```bash
supabase functions deploy validate-api-key
```

### Step 2: Update Existing AI Edge Functions (Optional)

To use the stored API keys in your existing AI edge functions, update them to use the shared integration utilities:

```typescript
// In your AI edge function (e.g., ai-chat-assistant/index.ts)
import { getOpenAIApiKey } from '../_shared/integration-utils.ts';

// Inside your handler
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const openaiApiKey = await getOpenAIApiKey(supabaseUrl, supabaseServiceKey);

if (!openaiApiKey) {
  return new Response(
    JSON.stringify({ error: 'OpenAI API key not configured' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

// Use openaiApiKey instead of Deno.env.get('OPENAI_API_KEY')
```

## Usage

### Admin Panel Configuration

1. **Navigate to Integrations**
   - Go to `/admin/integrations` in your application
   - You must be logged in as an admin

2. **Configure OpenAI**
   - Enter your OpenAI API key (starts with `sk-proj-...` or `sk-...`)
   - The key will be masked for security once saved
   - Click "Save API Key"

3. **Test the Connection**
   - Click "Test Connection" to validate the API key
   - The status badge will update based on the result

4. **Enable/Disable Integration**
   - Use the toggle switch to enable or disable the integration
   - Disabled integrations won't be used even if they have a valid key

### Getting API Keys

**OpenAI:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Create a new API key
4. Copy the key (it starts with `sk-proj-` or `sk-`)

**Anthropic (Coming Soon):**
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Copy the key

## Security

### Encryption

- API keys are stored encrypted in the database
- Only the masked version (first 3 and last 4 characters) is displayed in the UI
- Full keys are only accessible to edge functions with service role access

### Access Control

- Only users with the `admin` role can view/edit integration settings
- Row Level Security (RLS) policies enforce this at the database level
- Edge functions use service role keys to access the full API keys

### Best Practices

1. **Rotate Keys Regularly** - Update your API keys periodically
2. **Monitor Usage** - Check the integration analytics page
3. **Use Environment Variables for Development** - Keep dev keys in `.env` for local development
4. **Disable Unused Integrations** - Turn off integrations you're not using

## Fallback Behavior

The system supports a fallback mechanism:

1. **Primary**: Checks the `integration_settings` table for the API key
2. **Fallback**: If not found or inactive, checks environment variables
3. **Error**: If neither exists, the AI feature returns an error

This allows for:
- Gradual migration from env vars to database storage
- Development environments to use `.env` files
- Production to use the secure database storage

## Troubleshooting

### "API key not configured" Error

**Solution:**
1. Verify you've added the API key in `/admin/integrations`
2. Check that the integration is enabled (toggle switch)
3. Test the connection to ensure the key is valid

### "Failed to validate API key" Error

**Solution:**
1. Ensure the `validate-api-key` edge function is deployed
2. Check that your API key is correct
3. Verify network connectivity to the provider (OpenAI, etc.)

### "Permission denied" Error

**Solution:**
1. Verify you're logged in as an admin user
2. Check that RLS policies are correctly applied to `integration_settings`
3. Ensure the admin role exists in `user_roles` table

### Integration Not Working After Configuration

**Solution:**
1. Check if the edge function is using the new `getOpenAIApiKey()` utility
2. Verify the edge function has been redeployed
3. Check edge function logs for errors

## Extending to Other Providers

To add support for a new provider (e.g., Google AI, Perplexity):

### 1. Create the Integration Card Component

```typescript
// src/components/admin/GoogleAIIntegrationCard.tsx
// Similar to OpenAIIntegrationCard.tsx
```

### 2. Add to Integrations Page

```typescript
// src/pages/admin/Integrations.tsx
import GoogleAIIntegrationCard from '@/components/admin/GoogleAIIntegrationCard';

// In the AI Providers tab:
<GoogleAIIntegrationCard />
```

### 3. Add Validation Logic

```typescript
// supabase/functions/validate-api-key/index.ts
async function validateGoogleAI(apiKey: string): Promise<ValidationResponse> {
  // Add validation logic
}

// In the main handler:
case 'google_ai':
  result = await validateGoogleAI(apiKey);
  break;
```

### 4. Add Helper Function

```typescript
// supabase/functions/_shared/integration-utils.ts
export async function getGoogleAIApiKey(
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string | null> {
  // Similar to getOpenAIApiKey
}
```

## Migration from Environment Variables

If you're currently using environment variables for API keys:

### Option 1: Gradual Migration (Recommended)

1. Keep environment variables in place
2. Configure integration settings in the admin panel
3. The system will automatically prefer database values
4. Remove environment variables when ready

### Option 2: Full Migration

1. Configure all integrations in the admin panel
2. Test thoroughly
3. Remove environment variables from edge function secrets
4. Update documentation

## API Reference

### Hook: `useIntegrationSetting`

```typescript
const { data, isLoading } = useIntegrationSetting('openai');
```

Returns the integration setting for a specific provider.

### Hook: `useSaveIntegrationSetting`

```typescript
const mutation = useSaveIntegrationSetting();

mutation.mutate({
  provider_name: 'openai',
  api_key: 'sk-proj-...',
  config: { /* optional */ }
});
```

Saves or updates an integration setting.

### Hook: `useValidateIntegrationKey`

```typescript
const mutation = useValidateIntegrationKey();

mutation.mutate({
  provider_name: 'openai',
  api_key: 'sk-proj-...'
});
```

Validates an API key with the provider.

### Edge Function: `getOpenAIApiKey`

```typescript
import { getOpenAIApiKey } from '../_shared/integration-utils.ts';

const apiKey = await getOpenAIApiKey(supabaseUrl, supabaseServiceKey);
```

Retrieves the OpenAI API key (database first, then env fallback).

## Database Schema

```sql
CREATE TABLE integration_settings (
  id UUID PRIMARY KEY,
  provider_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  api_key TEXT,                    -- Encrypted
  api_key_masked TEXT,             -- For display: "sk-...xyz"
  config JSONB,                    -- Provider-specific settings
  is_active BOOLEAN,               -- Enable/disable toggle
  last_validated_at TIMESTAMPTZ,   -- Last validation check
  validation_status TEXT,          -- 'valid', 'invalid', 'not_tested', 'error'
  validation_error TEXT,           -- Error message if validation fails
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);
```

## Next Steps

- [ ] Run the database migration
- [ ] Deploy the validate-api-key edge function
- [ ] Configure OpenAI integration in the admin panel
- [ ] Test the AI features to ensure they work
- [ ] (Optional) Update existing edge functions to use the new utilities
- [ ] (Optional) Add support for additional providers

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review edge function logs in Supabase Dashboard
3. Check browser console for client-side errors
4. Verify RLS policies are correctly applied

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-10  
**Author:** SJ Innovation Framework
