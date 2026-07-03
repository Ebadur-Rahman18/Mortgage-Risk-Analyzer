# Google AI (Gemini) Integration

![Status](https://img.shields.io/badge/Status-Available-green)
![API](https://img.shields.io/badge/API-Generative%20Language%20v1-blue)

## Overview

Access Google's Gemini AI models for chat completions, text generation, and embeddings through the Generative Language API.

**Current Status**: Fully implemented and available via AI provider routing.

---

## Quick Start Checklist

- [ ] Google Cloud Console access
- [ ] Generative Language API enabled
- [ ] API key created
- [ ] `GOOGLE_AI_API_KEY` added to Supabase secrets
- [ ] AI provider enabled in admin settings

**Estimated Setup Time**: 10-15 minutes

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_AI_API_KEY` | Yes | API key for Gemini access |

---

## Available Models

| Model | Use Case | Context Window | Notes |
|-------|----------|----------------|-------|
| `gemini-2.5-flash` | Fast chat | 1M tokens | Recommended for chat |
| `gemini-2.5-pro` | Complex tasks | 1M tokens | Best quality |
| `gemini-2.0-flash` | Balanced | 1M tokens | Good all-around |
| `text-embedding-004` | Embeddings | 2,048 tokens | For semantic search |

---

## Setup Instructions

### Step 1: Enable Generative Language API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Library**
3. Search for "Generative Language API"
4. Click **Enable**

### Step 2: Create API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. (Optional) Restrict key to Generative Language API
4. Copy the API key

### Step 3: Configure in Control Tower

Add to Supabase secrets:

```bash
GOOGLE_AI_API_KEY=your-api-key
```

### Step 4: Enable Provider

1. Go to **Admin** > **AI Model Management**
2. Enable Google provider
3. Select default model

---

## API Reference

**Base URL**: `https://generativelanguage.googleapis.com/v1`

### Generate Content (Chat)

```http
POST /models/gemini-2.5-flash:generateContent?key={API_KEY}
Content-Type: application/json

{
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "Hello, how can you help me today?"}]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 1024
  }
}
```

**Response:**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [{"text": "I'm here to help! I can..."}],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 10,
    "candidatesTokenCount": 50,
    "totalTokenCount": 60
  }
}
```

### Generate Embeddings

```http
POST /models/text-embedding-004:embedContent?key={API_KEY}
Content-Type: application/json

{
  "content": {
    "parts": [{"text": "Text to embed for semantic search"}]
  }
}
```

**Response:**
```json
{
  "embedding": {
    "values": [0.123, -0.456, 0.789, ...]
  }
}
```

### Streaming Response

```http
POST /models/gemini-2.5-flash:streamGenerateContent?key={API_KEY}
Content-Type: application/json

{
  "contents": [{"parts": [{"text": "Write a story"}]}]
}
```

---

## Edge Functions

### `ai-chat-assistant`

**Purpose**: AI chat with provider routing

**Location**: `supabase/functions/ai-chat-assistant/index.ts`

**How it works**:
1. Receives chat request
2. Routes to configured AI provider (including Google)
3. Returns response with usage metrics

**Usage**:
```typescript
const { data } = await supabase.functions.invoke('ai-chat-assistant', {
  body: {
    message: "What is the capital of France?",
    agent_id: "general-assistant",
    session_id: "session-123"
  }
});
```

### `generate-embeddings`

**Purpose**: Generate text embeddings for semantic search

**Location**: `supabase/functions/generate-embeddings/index.ts`

**Usage**:
```typescript
const { data } = await supabase.functions.invoke('generate-embeddings', {
  body: {
    text: "Document content to embed",
    entity_type: "knowledge_entry",
    entity_id: "entry-123"
  }
});
```

---

## Provider Configuration

In the `ai_providers` table:

```json
{
  "name": "Google",
  "slug": "google",
  "enabled": true,
  "api_key_secret_name": "GOOGLE_AI_API_KEY",
  "base_url": "https://generativelanguage.googleapis.com/v1"
}
```

---

## Pricing

| Model | Input | Output |
|-------|-------|--------|
| Gemini 2.5 Flash | $0.15/1M tokens | $0.60/1M tokens |
| Gemini 2.5 Pro | $1.25/1M tokens | $5.00/1M tokens |
| text-embedding-004 | $0.00/1M tokens | N/A |

*Prices as of January 2026. Check [Google AI Pricing](https://ai.google.dev/pricing) for current rates.*

---

## Testing Checklist

- [ ] API key is configured in Supabase secrets
- [ ] Google provider is enabled in AI Models admin
- [ ] Chat completions work via `ai-chat-assistant`
- [ ] Embeddings work via `generate-embeddings`
- [ ] Usage metrics are logged correctly

---

## Troubleshooting

### "API key not valid" error

**Solution**:
1. Verify `GOOGLE_AI_API_KEY` in Supabase secrets
2. Check API key has Generative Language API enabled
3. Ensure no usage restrictions are blocking

### "Model not found" error

**Solution**:
1. Check model name is correct
2. Verify model is available in your region
3. Some models require Workspace account

### Slow response times

**Solution**:
1. Use `gemini-2.5-flash` for faster responses
2. Reduce `maxOutputTokens`
3. Use streaming for long responses

---

## Rate Limits

| Quota | Free Tier | Paid Tier |
|-------|-----------|-----------|
| Requests per minute | 15 | 1,000+ |
| Tokens per minute | 1,000,000 | 4,000,000+ |

---

## Security Considerations

1. **Never expose API key in frontend** - Use edge functions only
2. **Monitor usage** - Set up billing alerts
3. **Implement rate limiting** - Prevent abuse
4. **Log requests** - Track AI usage per user

---

## Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini API Reference](https://ai.google.dev/api)
- [Google AI Studio](https://aistudio.google.com/)
- [Pricing Calculator](https://ai.google.dev/pricing)

---

**Last Updated**: January 5, 2026
