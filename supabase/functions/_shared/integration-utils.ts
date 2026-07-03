/**
 * Integration Utilities
 * Shared utilities for accessing integration settings from edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Get API key for a specific provider
 * This should be called from edge functions to retrieve stored API keys
 */
export async function getProviderApiKey(
  provider: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string | null> {
  try {
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the integration setting
    const { data, error } = await supabase
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', provider)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching ${provider} API key:`, error);
      return null;
    }

    if (!data || !data.is_active) {
      console.warn(`${provider} integration is not active or not configured`);
      return null;
    }

    return data.api_key || null;
  } catch (error) {
    console.error(`Failed to retrieve ${provider} API key:`, error);
    return null;
  }
}

/**
 * Get OpenAI API key
 * First tries to get from database, falls back to environment variable
 */
export async function getOpenAIApiKey(
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string | null> {
  // Try to get from database first
  const dbApiKey = await getProviderApiKey('openai', supabaseUrl, supabaseServiceKey);
  
  if (dbApiKey) {
    return dbApiKey;
  }

  // Fallback to environment variable
  const envApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!envApiKey) {
    console.error('OpenAI API key not found in database or environment variables');
    return null;
  }

  console.info('Using OpenAI API key from environment variable (fallback)');
  return envApiKey;
}

/**
 * Get Anthropic API key
 * First tries to get from database, falls back to environment variable
 */
export async function getAnthropicApiKey(
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string | null> {
  const dbApiKey = await getProviderApiKey('anthropic', supabaseUrl, supabaseServiceKey);
  
  if (dbApiKey) {
    return dbApiKey;
  }

  const envApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  
  if (!envApiKey) {
    console.error('Anthropic API key not found in database or environment variables');
    return null;
  }

  console.info('Using Anthropic API key from environment variable (fallback)');
  return envApiKey;
}

/**
 * Check if a provider integration is active
 */
export async function isProviderActive(
  provider: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('integration_settings')
      .select('is_active')
      .eq('provider_name', provider)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return data.is_active === true;
  } catch (error) {
    console.error(`Error checking if ${provider} is active:`, error);
    return false;
  }
}
