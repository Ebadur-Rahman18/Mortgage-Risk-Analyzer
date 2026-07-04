# MCT Lite — Local Development Guide

Mortgage Control Tower (MCT Lite) is a mortgage LOS + AI control tower built with React, Vite, TypeScript, and Supabase.

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

---

## Admin login credentials

Sign in at `/login` with:

| Field | Value |
|-------|--------|
| **Admin email** | `ebadur.rahman@sjinnovation.com` |
| **Password** | `User@123` |

**Admin panel:** `/admin` (or profile menu → Admin)

**Module management:** `/admin/modules`

---

## Environment

Copy `.env` (or `.env.example` if present) and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Edge functions and integrations (Google AI, OpenAI, etc.) are configured in **Admin → Integrations** or Supabase Edge Function secrets.

---

## Related docs

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../../AGENTS.md) | Agent/coding guidelines for this repo |
| [Test.md](../../Test.md) | UI test plan for Mortgage Risk Copilot |
| [docs/EDGE_FUNCTION_DEPLOY.md](../EDGE_FUNCTION_DEPLOY.md) | Edge function deployment |
| [docs/README.md](../README.md) | Full CollabAI / platform documentation index |
