# SJ Control Tower Framework

## Project Overview

This is the **SJ Innovation Framework V1** (also known as SJ Control Tower Framework) - a comprehensive full-stack business management platform built with React, TypeScript, Vite, and Supabase. It's designed as a reusable framework for building enterprise applications with authentication, client management, meetings, knowledge base, and AI capabilities.

**Project Type**: Full-stack web application framework
**Primary Purpose**: Business management platform with CRM, meetings, knowledge base, and AI agents
**Stack**: React 18 + TypeScript + Vite + Supabase + shadcn/ui

## Technology Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript 5.8.3
- **Build Tool**: Vite 5.4.19
- **Routing**: React Router v6.30.1
- **Styling**: Tailwind CSS 3.4.17 + shadcn/ui (51 components)
- **UI Library**: Radix UI primitives + shadcn/ui components
- **State Management**: TanStack React Query 5.83.0 + React Context
- **Forms**: React Hook Form 7.61.1 + Zod 3.25.76 validation
- **Theme**: next-themes 0.3.0 for dark mode support

### Backend & Infrastructure
- **Database**: PostgreSQL via Supabase (with Row Level Security)
- **Backend**: Supabase Edge Functions (Deno-based serverless)
- **Authentication**: Supabase Auth (Google OAuth + Email/Password)
- **File Storage**: Supabase Storage
- **Real-time**: Supabase Realtime subscriptions

### External Integrations
- **AI Providers**: OpenAI (primary), with multi-provider routing capability
- **Google**: OAuth authentication + Google Drive integration
- **Zoom**: Meeting integration, transcripts, recordings
- **Email**: SendGrid for notifications

## Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── auth/           # AdminRoute, ProtectedRoute
│   │   ├── layout/         # DashboardLayout, AppSidebar, TopNav
│   │   └── ui/             # 51 shadcn/ui components
│   ├── contexts/
│   │   └── AuthContext.tsx # Authentication state management
│   ├── hooks/
│   │   ├── useClients.ts   # Client management hooks
│   │   ├── useMeetings.ts  # Meeting management hooks
│   │   ├── useKnowledge.ts # Knowledge base hooks
│   │   └── use-toast.ts    # Toast notifications
│   ├── integrations/       # Supabase client & utilities
│   ├── lib/                # Utilities (validation, cache, etc.)
│   ├── pages/              # Route components
│   │   ├── Index.tsx       # Landing page
│   │   ├── Login.tsx       # Authentication
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Clients.tsx     # Client management
│   │   ├── Meetings.tsx    # Meeting management
│   │   ├── Knowledge.tsx   # Knowledge base
│   │   ├── AIChat.tsx      # AI chat interface
│   │   └── Admin.tsx       # Admin panel (role-protected)
│   ├── App.tsx             # Root component with routing
│   └── main.tsx            # Application entry point
├── supabase/
│   ├── functions/          # Edge functions (31+ functions)
│   │   ├── ai-chat-assistant/
│   │   ├── semantic-search/
│   │   ├── google-drive/
│   │   ├── sync-zoom-files/
│   │   └── ...
│   ├── migrations/         # Database schema migrations
│   ├── auth-middleware.ts  # Auth utilities for edge functions
│   ├── cors.ts             # CORS configuration
│   └── config.toml         # Supabase configuration
├── docs/                   # Comprehensive framework documentation
│   ├── README.md           # Framework overview
│   ├── QUICKSTART_LOVABLE.md
│   ├── sj-innovation-framework_architecture.md
│   ├── sj-innovation-framework_ai-agents.md
│   ├── sj-innovation-framework_knowledge-base.md
│   └── sj-innovation-framework_meetings-zoom.md
└── public/                 # Static assets
```

## Core Features & Modules

### ✅ Included in V1

1. **Authentication & Security**
   - Google OAuth + Email/Password authentication
   - Role-based access control (Admin, User roles)
   - Protected routes and admin routes
   - Row Level Security (RLS) on all tables
   - XSS protection and input sanitization

2. **User Management**
   - User profiles with roles and departments
   - Admin panel for user management
   - Role assignment and permissions

3. **Client Management** (CRM)
   - Contact and company management
   - Client details and relationships
   - CRUD operations with validation

4. **Meetings Module**
   - Full manual CRUD (create, read, update, delete) — fully implemented
   - Status lifecycle: `scheduled` → `completed` / `cancelled` with `CHECK` constraint
   - Admin-only creation and status changes; read access for all authenticated users
   - `organizer_id` auto-set from authenticated user; optional `client_id` FK
   - End-time calculation in list and detail views (`scheduled_at + duration_minutes`)
   - `location` field displayed in form, list, and detail
   - Status change buttons ("Mark Completed", "Cancel Meeting") on detail page for admins
   - Locked form state for non-admins on completed/cancelled meetings
   - Zoom integration scaffolded but not yet activated

5. **Knowledge Base**
   - Admin knowledge library (shared)
   - Personal knowledge libraries (per-user)
   - Document upload and categorization
   - Google Drive integration
   - Vector embeddings for semantic search
   - File management with metadata

6. **AI Agents Framework**
   - Multi-provider AI routing (OpenAI, etc.)
   - Chat assistants with context
   - Semantic search across documents
   - Meeting summarization
   - Agent personalization per user
   - AI chat history tracking

7. **Admin Panel**
   - User and role management
   - AI agent configuration
   - System settings
   - Protected by AdminRoute

8. **Notifications System**
   - Toast notifications (in-app)
   - Email notifications (SendGrid)

9. **UI Components**
   - 51 shadcn/ui components
   - Dark mode support
   - Responsive design
   - Accessible components (Radix UI)

### ❌ Excluded from V1
- Projects & Tasks management
- OKRs & EOS frameworks
- Productivity tracking
- Email generation
- PODs management
- Deals & Opportunities
- HubSpot integration
- ActiveCollab integration

## Key Architectural Patterns

### 1. **Protected Route Pattern**
All authenticated pages are wrapped in `<ProtectedRoute>`, admin pages use `<AdminRoute>`:
```typescript
<Route element={<ProtectedRoute />}>
  <Route element={<DashboardLayout />}>
    <Route path="/dashboard" element={<Dashboard />} />
  </Route>
</Route>
```

### 2. **React Query for Data Fetching**
All data fetching uses TanStack Query with proper query keys:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['clients', userId],
  queryFn: () => fetchClients(userId)
});
```

### 3. **Custom Hooks Pattern**
Business logic is encapsulated in custom hooks:
- `useClients()` - Client CRUD operations
- `useMeetings()` - Meeting management
- `useKnowledge()` - Knowledge base operations

### 4. **Row Level Security (RLS)**
All database tables enforce RLS policies for data isolation and security.

### 5. **Edge Function Wrapper**
Edge functions use consistent patterns:
- CORS handling via `cors.ts`
- Authentication via `auth-middleware.ts`
- Error handling via `error-handler.ts`
- Input validation and sanitization

### 6. **Multi-Provider AI Routing**
AI requests can route to different providers based on configuration in `ai-provider-routing.ts`.

## Important Files

### Configuration
- `vite.config.ts` - Vite build configuration with path aliases
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `components.json` - shadcn/ui component configuration
- `.env` - Environment variables (Supabase keys, API keys)

### Core Application
- `src/main.tsx` - Application entry point
- `src/App.tsx` - Root component with all route definitions
- `src/contexts/AuthContext.tsx` - Authentication state and user context

### Security & Validation
- `src/lib/validation.ts` - Input validation utilities
- `src/lib/cache.ts` - Caching utilities
- `supabase/auth-middleware.ts` - Edge function authentication
- `supabase/secure-encryption.ts` - Encryption utilities

### Key Edge Functions
- `ai-chat-assistant/` - AI chat functionality
- `semantic-search/` - Vector search across documents
- `sync-zoom-files/` - Zoom integration
- `google-drive/` - Google Drive sync
- `generate-embeddings/` - Vector embeddings generation

## Development Workflow

### Setup
```bash
npm install              # Install dependencies
npm run dev             # Start development server (port 5173)
npm run build           # Production build
npm run build:dev       # Development build
npm run preview         # Preview production build
npm run lint            # Run ESLint
```

### Database Management
```bash
supabase init           # Initialize Supabase locally
supabase link           # Link to Supabase project
supabase db push        # Push migrations to database
supabase functions deploy <name>  # Deploy edge function
```

### Git Workflow
- **Current Branch**: `claude/update-claude-md-RWGsU`
- Always develop on Claude-specific branches
- Commit with clear, descriptive messages
- Push to origin with `-u` flag for new branches

## Database Schema

### Core Tables
- `profiles` - User profiles with roles and departments
- `user_roles` - Role assignments (admin, user, etc.)
- `clients` - Client/contact management
- `meetings` - Meeting records
- `meeting_transcripts` - Meeting transcripts
- `zoom_files` - Zoom recording metadata
- `knowledge_entries` - Knowledge base entries
- `knowledge_files` - File metadata
- `user_knowledge_files` - Personal knowledge files
- `embeddings` - Vector embeddings for search
- `ai_agents` - AI agent configurations
- `ai_agent_runs` - AI execution logs
- `ai_chat_history` - Chat conversation history
- `notifications` - User notifications
- `feedback` - User feedback collection

All tables have RLS policies enforcing proper access control.

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=        # Supabase project URL
VITE_SUPABASE_ANON_KEY=   # Supabase anonymous key
```

Edge functions may require:
- `OPENAI_API_KEY` - OpenAI API access
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` - Zoom integration
- `SENDGRID_API_KEY` - Email notifications

## Common Tasks

### Adding a New Page
1. Create page component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Add navigation item in `src/components/layout/AppSidebar.tsx`
4. Wrap in `<ProtectedRoute>` or `<AdminRoute>` as needed

### Adding a New Feature Module
1. Create database tables with RLS policies
2. Create edge functions if needed
3. Create custom hooks for data operations
4. Create UI components and pages
5. Add routes and navigation
6. Document in `docs/` folder

### Creating a New Edge Function
1. Create function folder in `supabase/functions/`
2. Use CORS and auth middleware
3. Implement error handling
4. Deploy: `supabase functions deploy <function-name>`

### Working with Forms
Use React Hook Form + Zod:
```typescript
const form = useForm<FormSchema>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... }
});
```

## Security Best Practices

1. **Always sanitize user input** - Use validation utilities
2. **Never bypass RLS** - All database queries respect RLS
3. **Validate on edge functions** - Server-side validation is critical
4. **Use type-safe queries** - TypeScript types for database operations
5. **Implement proper CORS** - Use provided CORS utilities
6. **Protect sensitive routes** - Use ProtectedRoute/AdminRoute
7. **Never commit secrets** - Keep `.env` in `.gitignore`

## Documentation

Comprehensive documentation is available in `/docs/`:
- `README.md` - Framework overview and quick start
- `QUICKSTART_LOVABLE.md` - Lovable.dev deployment guide
- `sj-innovation-framework_architecture.md` - Visual architecture diagrams
- `sj-innovation-framework_ai-agents.md` - AI module documentation
- `sj-innovation-framework_knowledge-base.md` - Knowledge base module
- `sj-innovation-framework_meetings-zoom.md` - Meetings module
- `sj-innovation-framework_setup.md` - Local setup guide
- `sj-innovation-framework_cleanup-checklist.md` - Pre-deployment cleanup

## Important Notes

1. **This is a framework** - Designed to be copied and customized for new projects
2. **Modular architecture** - Features can be removed or added as needed
3. **Security first** - RLS, input validation, and XSS protection throughout
4. **Type safety** - Full TypeScript coverage
5. **Well documented** - Extensive docs in `/docs/` folder
6. **Production ready** - Includes error handling, caching, performance monitoring

## Current Branch Info

- **Active Branch**: `claude/update-claude-md-RWGsU`
- **Status**: Clean working directory
- **Recent Work**: Meetings module — full manual CRUD, status system (`scheduled / completed / cancelled`), RLS policies, Zod validation, permission-aware UI, end-time calculation, location field, admin-only status actions

## When Working on This Project

1. **Read relevant docs** in `/docs/` before making changes
2. **Follow existing patterns** - Check similar components/pages
3. **Use custom hooks** - Don't duplicate data fetching logic
4. **Test with RLS** - Ensure policies work correctly
5. **Update documentation** - Keep docs in sync with code changes
6. **Commit frequently** - Clear, descriptive commit messages
7. **Never push secrets** - Review changes before committing

## Quick Reference

### Run Dev Server
```bash
npm run dev
```

### Key Directories
- UI Components: `src/components/ui/`
- Pages: `src/pages/`
- Hooks: `src/hooks/`
- Edge Functions: `supabase/functions/`
- Documentation: `docs/`

### Key Patterns
- Protected routes in `App.tsx`
- Auth context in `contexts/AuthContext.tsx`
- Data fetching hooks in `hooks/`
- Validation in `lib/validation.ts`

---

**Framework Version**: 1.0.0
**Last Updated**: 2025-12-31
