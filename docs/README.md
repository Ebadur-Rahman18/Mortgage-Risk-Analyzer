# CollabAi

![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMjFDMTIgMjEgMyAxNS41IDMgOC41QzMgNS40NiA1LjQ2IDMgOC41IDNDMTAuMDQgMyAxMS41NCAzLjgyIDEyLjUgNS4wOUMxMy40NiAzLjgyIDE0Ljk2IDMgMTYuNSAzQzE5LjU0IDMgMjIgNS40NiAyMiA4LjVDMjIgMTUuNSAxMiAyMSAxMiAyMVoiIGZpbGw9IiNmZjY5YjQiLz48L3N2Zz4=)
![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

> **🚀 Built entirely with [Lovable.dev](https://lovable.dev) + [Supabase](https://supabase.com)**
>
> No local development environment required. All development, preview, and deployment happens in the browser.

---

## 🛠️ Development Framework

| Platform | Role | Documentation |
|----------|------|---------------|
| **[Lovable.dev](https://lovable.dev)** | AI-powered frontend development, instant preview, one-click publish | [Lovable Docs](https://docs.lovable.dev) |
| **[Supabase](https://supabase.com)** | PostgreSQL database, authentication, file storage, edge functions | [Supabase Docs](https://supabase.com/docs) |

### Why Lovable + Supabase?

- ✅ **No local setup** - Everything runs in the browser
- ✅ **AI-assisted development** - Describe what you want, Lovable builds it
- ✅ **Instant preview** - See changes immediately in the browser
- ✅ **One-click deploy** - Click "Publish" to go live
- ✅ **Full-stack in browser** - Frontend + backend, no CLI required
- ✅ **Open-source backend** - Supabase is PostgreSQL-based, no vendor lock-in

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| [**QUICKSTART.md**](./QUICKSTART.md) | Getting started guide for new deployments |
| [**product-backlog.md**](./product-backlog.md) | Product roadmap and feature backlog |
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | Technical architecture and data flow |
| [**DEPLOYMENT.md**](./DEPLOYMENT.md) | Deployment checklist for new clients |
| [**ADMIN-GUIDE.md**](./ADMIN-GUIDE.md) | Admin configuration and user management |

---

## 🎯 Platform Overview

**CollabAi** is a configurable multi-tenant SaaS platform for internal company use.

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Development** | [Lovable.dev](https://lovable.dev) | AI-powered web IDE, preview, deployment |
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS | Modern web application |
| **Backend** | [Supabase](https://supabase.com) | PostgreSQL + Auth + Storage + Edge Functions |
| **UI Components** | shadcn/ui | 51+ pre-built accessible components |

### Core Modules

| Module | Description | Status |
|--------|-------------|--------|
| **Dashboard** | Real-time analytics with live stats, activity feed, task overview charts | ✅ Complete |
| **Clients** | Client/company management with CRUD | ✅ Complete |
| **Meetings** | Full manual CRUD — schedule, edit, view, delete; status lifecycle (scheduled/completed/cancelled); admin-only creation & status changes; end-time calculation; Zoom fields scaffolded | ✅ Complete |
| **Tasks / Action Items** | Action items and lightweight task management with assignments, start/due dates, rich status workflow, watchers, and threaded comments | ✅ Complete |
| **Knowledge Base** | Searchable knowledge entries with categories | ✅ Complete |
| **AI Chat** | Per-agent, multi-thread AI chat interface with persistent history and automatic conversation titles | ✅ Complete |
| **AI Agents** | Full CRUD + execution with history tracking | ✅ Complete |
| **Notifications** | Real-time notifications with Supabase subscriptions | ✅ Complete |
| **Admin Panel** | User/role management, system settings, activity logs | ✅ Complete |
| **System Settings** | Platform branding, feature flags, email/system config | ✅ Complete |
| **Role Management** | 23 permissions across all resources | ✅ Complete |
| **User Preferences** | Database-backed settings (notifications, theme, privacy, AI) | ✅ Complete |
| **Profile Page** | Full profile editing with password change | ✅ Complete |

---

## 🚀 Quick Start (Using Lovable + Supabase)

**Prerequisites:**
- [Lovable.dev](https://lovable.dev) account (free to start)
- Supabase is auto-provisioned by Lovable (or connect external project)

### Development Workflow

```
1. Open project in Lovable.dev (web-based IDE)
2. Make changes via AI chat or code editor
3. Preview instantly in browser
4. Click "Publish" to deploy
5. Configure backend in Supabase Dashboard
```

**No CLI, no local environment, no DevOps required.**

### For New Deployments

1. **Fork/remix the project** in Lovable
2. **Connect Supabase** (auto-provisioned or external)
3. **Configure branding** via Admin Panel
4. **Enable features** as needed
5. **Invite users** and assign roles
6. **Publish** to production

See [QUICKSTART.md](./QUICKSTART.md) for detailed steps.

---

## 🔐 Authentication

### Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| `demo@collabai.software` | User | `Demo@123` |
| `admin@collabai.software` | Admin | `Admin@123` |

### Supported Auth Methods (via Supabase Auth)

- ✅ Email/Password
- ✅ Google OAuth (requires configuration)
- 🔲 Magic Link (coming soon)

---

## 📊 Database Schema (Supabase PostgreSQL)

The platform uses core tables with Row Level Security (RLS). Key tables include:

```
profiles             - User profile information
user_roles           - Role assignments (admin, moderator, user)
roles                - Role definitions
clients              - Client/company data
meetings             - Meeting records
action_items         - Meeting and general action items with workflow, dates, and watchers
task_comments        - Threaded comments on action items
tasks                - Legacy/general task tracking with assignments and priorities
zoom_files           - Zoom recordings/transcripts
knowledge_entries    - Knowledge base articles
knowledge_categories - Article categories
ai_agents            - AI agent configurations
ai_agent_runs        - AI execution logs
ai_chat_history      - Chat conversations
ai_chat_threads      - Per-user, per-agent chat threads with JSON message history
embeddings           - Vector embeddings for RAG
feedback             - User feedback
notifications        - User notifications
```

Manage your database schema in the **Supabase Dashboard** → Table Editor.

---

## ⚙️ Configuration

### Environment Variables (Supabase Edge Function Secrets)

Configure secrets in **Supabase Dashboard** → Settings → Edge Function Secrets:

| Secret | Required | Purpose |
|--------|----------|---------|
| `SUPABASE_URL` | ✅ Auto-set | Project URL |
| `SUPABASE_ANON_KEY` | ✅ Auto-set | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Auto-set | Admin API key |
| `OPENAI_API_KEY` | ✅ For AI | OpenAI integration |
| `ZOOM_CLIENT_ID` | 🔲 Optional | Zoom integration |
| `ZOOM_CLIENT_SECRET` | 🔲 Optional | Zoom integration |
| `ZOOM_ACCOUNT_ID` | 🔲 Optional | Zoom integration |
| `GOOGLE_CLIENT_ID` | 🔲 Optional | Google Drive sync |
| `GOOGLE_CLIENT_SECRET` | 🔲 Optional | Google Drive sync |
| `SENDGRID_API_KEY` | 🔲 Optional | Email notifications |

---

## 📁 Project Structure

```
collabai/
├── docs/                    # Documentation
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── auth/            # Authentication components
│   │   ├── layout/          # Layout (Sidebar, TopNav)
│   │   └── ui/              # shadcn/ui components
│   ├── contexts/            # React contexts (Auth)
│   ├── hooks/               # Custom hooks
│   ├── integrations/        # Supabase client
│   ├── lib/                 # Utilities
│   └── pages/               # Page components
├── supabase/
│   ├── functions/           # Edge functions (Deno)
│   └── migrations/          # Database migrations
├── index.html
├── package.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## 🚀 Deployment (via Lovable)

### How to Publish

1. Click **"Publish"** button in Lovable (top right)
2. Wait for build to complete
3. Configure custom domain (optional)
4. SSL is automatic

### Client Deployment Checklist

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete checklist:

- [ ] Supabase project configured
- [ ] Admin account created
- [ ] Branding configured
- [ ] Features enabled
- [ ] Users invited

---

## 📞 Support & Resources

| Resource | Link |
|----------|------|
| **Lovable Documentation** | [docs.lovable.dev](https://docs.lovable.dev) |
| **Supabase Documentation** | [supabase.com/docs](https://supabase.com/docs) |
| **Project Documentation** | This folder (`/docs`) |

---

**Development Platform:** [Lovable.dev](https://lovable.dev)  
**Backend Platform:** [Supabase](https://supabase.com)  
**Framework:** React 18 + Vite + TypeScript + Tailwind CSS

---

**Version:** 1.0.0  
**Last Updated:** 2026-03-12  
**Built with ❤️ using Lovable + Supabase**
