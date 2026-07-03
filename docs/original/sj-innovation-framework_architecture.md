# SJ Dashboard Framework - Visual Architecture

> **Visual diagrams** showing the framework structure, data flow, and component relationships.

---

## 🏗️ High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend - React + Vite"
        UI[UI Layer<br/>shadcn/ui + Tailwind]
        Components[Components<br/>Layout, Common, Features]
        Pages[Pages<br/>Dashboard, Clients, Meetings, etc.]
        State[State Management<br/>React Query + Context]
        Router[React Router v6]
    end

    subgraph "Security Layer"
        Auth[Auth Context<br/>Google OAuth + Email]
        Guards[Route Guards<br/>Protected, Admin, Module]
        Validation[Input Validation<br/>Sanitization + XSS Protection]
    end

    subgraph "Backend - Supabase"
        DB[(PostgreSQL<br/>with RLS)]
        EdgeFn[Edge Functions<br/>Serverless]
        Storage[File Storage]
        AuthSvc[Auth Service]
    end

    subgraph "External Integrations"
        Google[Google<br/>OAuth + Drive]
        Zoom[Zoom<br/>Meetings]
        OpenAI[OpenAI<br/>AI Agents]
        Slack[Slack<br/>Notifications]
    end

    Pages --> Components
    Components --> UI
    Pages --> State
    Pages --> Router
    State --> Auth
    Router --> Guards
    Components --> Validation

    Auth --> AuthSvc
    State --> DB
    State --> EdgeFn
    Components --> Storage

    EdgeFn --> Google
    EdgeFn --> Zoom
    EdgeFn --> OpenAI
    EdgeFn --> Slack

    style UI fill:#e3f2fd
    style Auth fill:#fff3e0
    style DB fill:#f3e5f5
    style EdgeFn fill:#e8f5e9
```

---

## 📦 Framework Layers

```mermaid
graph LR
    subgraph "Layer 1: Foundation"
        A1[Config Files<br/>Vite, Tailwind, TS]
        A2[Environment<br/>Variables]
        A3[Build Setup<br/>Scripts]
    end

    subgraph "Layer 2: Core Infrastructure"
        B1[Auth System<br/>Context + Guards]
        B2[UI Components<br/>51 shadcn components]
        B3[Utilities<br/>Validation, Cache, etc.]
        B4[Type System<br/>Database Types]
    end

    subgraph "Layer 3: Business Logic"
        C1[Pages<br/>Dashboard, Clients, etc.]
        C2[Feature Components<br/>Meetings, KB, AI]
        C3[Hooks<br/>Data Fetching]
        C4[API Layer<br/>Edge Functions]
    end

    subgraph "Layer 4: Integrations"
        D1[Supabase<br/>Client]
        D2[External APIs<br/>Zoom, Google, AI]
        D3[Notifications<br/>Email, Slack]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> C1
    B2 --> C1
    B3 --> C1
    B4 --> C1
    C1 --> D1
    C3 --> D1
    C4 --> D2
    C4 --> D3

    style A1 fill:#ffebee
    style B1 fill:#e3f2fd
    style C1 fill:#f3e5f5
    style D1 fill:#e8f5e9
```

---

## 🔐 Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant AuthContext
    participant Supabase
    participant Google
    participant DB

    User->>App: Navigate to app
    App->>AuthContext: Check session
    AuthContext->>Supabase: Get session

    alt No Session
        Supabase-->>AuthContext: null
        AuthContext-->>App: Redirect to login
        User->>App: Click "Sign in with Google"
        App->>Supabase: Initiate OAuth
        Supabase->>Google: OAuth request
        Google->>User: Auth consent
        User->>Google: Approve
        Google->>Supabase: Auth token
        Supabase->>DB: Create/update user
        DB-->>Supabase: User data
        Supabase->>AuthContext: Session + Profile
    else Has Session
        Supabase-->>AuthContext: Session data
        AuthContext->>DB: Fetch profile
        DB-->>AuthContext: Profile data
    end

    AuthContext->>App: User authenticated
    App->>User: Show dashboard

    Note over AuthContext,DB: Profile auto-creation<br/>if missing
```

---

## 🛡️ Route Protection System

```mermaid
graph TB
    Request[User Request] --> Router{React Router}

    Router --> Public[Public Routes<br/>Login, Landing]
    Router --> Protected{Protected Route?}

    Protected -->|Yes| AuthCheck{Authenticated?}
    AuthCheck -->|No| Login[Redirect to Login]
    AuthCheck -->|Yes| AdminCheck{Admin Route?}

    AdminCheck -->|No| ModuleCheck{Module Route?}
    AdminCheck -->|Yes| IsAdmin{Is Admin?}

    IsAdmin -->|No| Forbidden[403 Forbidden]
    IsAdmin -->|Yes| AllowAdmin[Allow Access]

    ModuleCheck -->|No| AllowAuth[Allow Access]
    ModuleCheck -->|Yes| HasModule{Has Module Access?}

    HasModule -->|No| Forbidden
    HasModule -->|Yes| AllowModule[Allow Access]

    style Login fill:#ffcdd2
    style Forbidden fill:#ffcdd2
    style AllowAdmin fill:#c8e6c9
    style AllowAuth fill:#c8e6c9
    style AllowModule fill:#c8e6c9
    style Public fill:#fff9c4
```

---

## 📊 Data Flow Architecture

```mermaid
graph LR
    subgraph "UI Components"
        Page[Page Component]
        Form[Form Component]
        List[List Component]
    end

    subgraph "Data Layer"
        Hook[Custom Hook<br/>useClients, useMeetings]
        Query[React Query<br/>Cache + State]
        Cache[Cache Layer<br/>5min - 24hr TTL]
    end

    subgraph "API Layer"
        Client[Supabase Client]
        Edge[Edge Functions]
        RLS[Row Level Security]
    end

    subgraph "Storage"
        DB[(PostgreSQL)]
        Files[File Storage]
    end

    Page --> Hook
    Form --> Hook
    List --> Hook

    Hook --> Query
    Query --> Cache
    Cache --> Client
    Client --> RLS
    Client --> Edge

    RLS --> DB
    Edge --> DB
    Edge --> Files

    style Cache fill:#fff3e0
    style Query fill:#e3f2fd
    style RLS fill:#ffebee
```

---

## 🎨 Component Hierarchy

```mermaid
graph TB
    App[App.tsx<br/>Root + Router]

    App --> Layout[Layout Components]
    App --> Pages[Page Components]

    Layout --> DashboardLayout[DashboardLayout<br/>Main app layout]
    Layout --> AdminLayout[AdminLayout<br/>Admin panel]

    DashboardLayout --> Sidebar[AppSidebar<br/>Navigation]
    DashboardLayout --> TopNav[TopNav<br/>Header]
    DashboardLayout --> Content[Page Content]

    Pages --> Dashboard[Dashboard<br/>Landing page]
    Pages --> Clients[Clients<br/>List + CRUD]
    Pages --> Meetings[Meetings<br/>Zoom integration]
    Pages --> Knowledge[Knowledge Base<br/>Search + AI]
    Pages --> AI[AI Agents<br/>Chat + Config]
    Pages --> Admin[Admin Pages<br/>User/Role management]

    Content --> Common[Common Components<br/>KPICard, StatusBadge, etc.]
    Content --> Feature[Feature Components<br/>Client-specific, Meeting-specific]

    Common --> UI[UI Components<br/>shadcn/ui 51 components]
    Feature --> UI

    style App fill:#e3f2fd
    style Layout fill:#f3e5f5
    style UI fill:#c8e6c9
```

---

## 🔄 State Management Pattern

```mermaid
graph TB
    Component[React Component]

    Component --> Hook[Custom Hook<br/>useClients]
    Hook --> QueryHook[useQuery/useMutation<br/>React Query]

    QueryHook --> CacheCheck{In Cache?}

    CacheCheck -->|Yes, Fresh| CacheHit[Return Cached Data]
    CacheCheck -->|No/Stale| Fetch[Fetch from API]

    Fetch --> Supabase[Supabase Client]
    Supabase --> DB[(Database)]

    DB --> Transform[Transform Data]
    Transform --> UpdateCache[Update Cache]
    UpdateCache --> Return[Return to Component]

    CacheHit --> Return

    Component --> Mutation[User Action<br/>Create/Update/Delete]
    Mutation --> MutationHook[useMutation]
    MutationHook --> API[API Call]
    API --> Invalidate[Invalidate Cache]
    Invalidate --> Refetch[Automatic Refetch]

    style CacheHit fill:#c8e6c9
    style Invalidate fill:#fff3e0
    style Return fill:#e3f2fd
```

---

## 🧩 Feature Module Structure

### **Example: Clients Module**

```mermaid
graph TB
    subgraph "Pages"
        ClientsPage[Clients.tsx<br/>List view]
        ClientForm[ClientForm.tsx<br/>Add/Edit]
        ClientDetail[ClientDetail.tsx<br/>Details view]
    end

    subgraph "Components"
        ClientCard[ClientCard.tsx]
        ClientTable[ClientTable.tsx]
        ClientSearch[ClientSearch.tsx]
    end

    subgraph "Hooks"
        useClients[useClients.ts<br/>Fetch list]
        useClient[useClient.ts<br/>Fetch single]
        useAddClient[useAddClient.ts<br/>Create]
        useUpdateClient[useUpdateClient.ts<br/>Update]
        useDeleteClient[useDeleteClient.ts<br/>Delete]
    end

    subgraph "Database"
        ClientsTable[(clients table)]
    end

    ClientsPage --> ClientTable
    ClientsPage --> ClientSearch
    ClientTable --> ClientCard

    ClientsPage --> useClients
    ClientForm --> useClient
    ClientForm --> useAddClient
    ClientForm --> useUpdateClient
    ClientCard --> useDeleteClient

    useClients --> ClientsTable
    useClient --> ClientsTable
    useAddClient --> ClientsTable
    useUpdateClient --> ClientsTable
    useDeleteClient --> ClientsTable

    style ClientsPage fill:#e3f2fd
    style useClients fill:#f3e5f5
    style ClientsTable fill:#c8e6c9
```

---

## 🤖 AI Framework Architecture

```mermaid
graph TB
    subgraph "Frontend"
        AIPage[AI Pages<br/>Chat, Config]
        KBPage[Knowledge Base<br/>Search]
    end

    subgraph "Hooks"
        useAI[useAI<br/>Chat hook]
        useSemanticSearch[useSemanticSearch<br/>Vector search]
    end

    subgraph "Edge Functions"
        AIChat[ai-chat-assistant<br/>GPT integration]
        SemanticSearch[semantic-search<br/>Vector embeddings]
        Summary[generate-meeting-summary<br/>AI summaries]
    end

    subgraph "AI Services"
        OpenAI[OpenAI API<br/>GPT-4, Embeddings]
        Gemini[Google Gemini<br/>Alternative AI]
    end

    subgraph "Database"
        Agents[(ai_agents<br/>Configurations)]
        Conversations[(ai_conversations<br/>Chat history)]
        Embeddings[(knowledge_embeddings<br/>Vector data)]
    end

    AIPage --> useAI
    KBPage --> useSemanticSearch

    useAI --> AIChat
    useSemanticSearch --> SemanticSearch

    AIChat --> OpenAI
    AIChat --> Gemini
    SemanticSearch --> OpenAI
    Summary --> OpenAI

    AIChat --> Conversations
    SemanticSearch --> Embeddings
    OpenAI --> Embeddings

    style AIChat fill:#fff3e0
    style OpenAI fill:#ffebee
    style Embeddings fill:#e8f5e9
```

---

## 📁 Directory Structure Visual

```
sj-dashboard-framework/
│
├── 📋 Configuration (Root)
│   ├── package.json              # Dependencies
│   ├── vite.config.ts            # Build config
│   ├── tailwind.config.ts        # Theming
│   └── tsconfig.*.json           # TypeScript
│
├── 📂 public/                    # Static assets
│   ├── logo.svg
│   └── placeholder.svg
│
├── 📂 src/
│   │
│   ├── 🎯 Entry Points
│   │   ├── main.tsx              # React entry
│   │   ├── App.tsx               # Root component
│   │   └── index.css             # Global styles
│   │
│   ├── ⚙️ Configuration
│   │   ├── config/
│   │   │   └── api.ts            # API endpoints
│   │   └── constants/
│   │       └── routes.ts         # Route constants
│   │
│   ├── 📘 Types
│   │   ├── database.ts           # Supabase types
│   │   └── edge-functions.ts    # Function types
│   │
│   ├── 🔐 Auth & Security
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── components/auth/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── AdminRoute.tsx
│   │   │   └── ModuleRoute.tsx
│   │   └── lib/
│   │       ├── sanitize.ts       # XSS protection
│   │       └── validation.ts     # Input validation
│   │
│   ├── 🎨 UI Components
│   │   └── components/
│   │       ├── ui/               # 51 shadcn components
│   │       ├── common/           # Reusable components
│   │       └── layout/           # Layouts
│   │
│   ├── 📄 Pages
│   │   └── pages/
│   │       ├── Dashboard.tsx
│   │       ├── Clients.tsx
│   │       ├── meetings/
│   │       ├── knowledge/
│   │       ├── ai/
│   │       └── admin/
│   │
│   ├── 🪝 Hooks
│   │   └── hooks/
│   │       ├── useClients.ts
│   │       ├── useMeetings.ts
│   │       ├── useKnowledge.ts
│   │       └── useAI.ts
│   │
│   └── 🛠️ Utilities
│       └── lib/
│           ├── utils.ts          # Core utilities
│           ├── cache.ts          # Caching system
│           ├── exportUtils.ts    # PDF/CSV export
│           └── edge-functions.ts # Function wrapper
│
└── 📂 supabase/
    ├── config.toml               # Supabase config
    ├── migrations/               # Database migrations
    └── functions/                # Edge functions
        ├── ai-chat-assistant/
        ├── semantic-search/
        ├── sync-zoom-files/
        └── send-notification/
```

---

## 🔄 Development Workflow

```mermaid
graph TB
    Start[Start New Feature]

    Start --> CreatePage[1. Create Page<br/>in /src/pages]
    CreatePage --> CreateHook[2. Create Hook<br/>in /src/hooks]
    CreateHook --> CreateComponent[3. Create Components<br/>in /src/components]

    CreateComponent --> AddRoute[4. Add Route<br/>in App.tsx]
    AddRoute --> AddNav[5. Add to Sidebar<br/>in AppSidebar.tsx]

    AddNav --> EdgeCheck{Need Edge<br/>Function?}

    EdgeCheck -->|Yes| CreateEdge[6a. Create Edge Function<br/>in /supabase/functions]
    EdgeCheck -->|No| DBCheck{Need DB<br/>Table?}

    CreateEdge --> DBCheck

    DBCheck -->|Yes| Migration[6b. Create Migration<br/>SQL schema]
    DBCheck -->|No| Types[7. Update Types<br/>database.ts]

    Migration --> Types
    Types --> Test[8. Test Feature]
    Test --> Deploy[9. Deploy]

    style Start fill:#e3f2fd
    style Test fill:#fff3e0
    style Deploy fill:#c8e6c9
```

---

## 🚀 Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DevCode[Local Code]
        DevDB[(Local Supabase)]
    end

    subgraph "Version Control"
        GitHub[GitHub Repository]
    end

    subgraph "CI/CD"
        Vercel[Vercel/Netlify]
        Build[Build Process<br/>Vite Build]
    end

    subgraph "Production"
        CDN[CDN<br/>Static Assets]
        ProdDB[(Supabase Cloud<br/>PostgreSQL)]
        EdgeFn[Edge Functions<br/>Serverless]
    end

    subgraph "Integrations"
        Google[Google OAuth]
        Zoom[Zoom API]
        OpenAI[OpenAI API]
    end

    DevCode --> GitHub
    GitHub --> Vercel
    Vercel --> Build
    Build --> CDN

    CDN --> Users[End Users]
    Users --> ProdDB
    Users --> EdgeFn

    EdgeFn --> Google
    EdgeFn --> Zoom
    EdgeFn --> OpenAI

    style DevCode fill:#e3f2fd
    style CDN fill:#c8e6c9
    style ProdDB fill:#f3e5f5
```

---

## 📊 Database Schema (V1 Tables)

```mermaid
erDiagram
    profiles ||--o{ user_roles : has
    roles ||--o{ user_roles : assigned
    roles ||--o{ role_permissions : has
    permissions ||--o{ role_permissions : granted

    profiles ||--o{ clients : creates
    profiles ||--o{ meetings : schedules
    profiles ||--o{ knowledge_entries : authors
    profiles ||--o{ feedback : submits
    profiles ||--o{ notifications : receives

    meetings ||--o{ zoom_files : has
    meetings ||--o{ meeting_transcripts : has

    knowledge_entries ||--o{ knowledge_categories : categorized
    knowledge_entries ||--o{ knowledge_embeddings : embedded

    ai_agents ||--o{ ai_conversations : powers

    profiles {
        uuid id PK
        string email
        string full_name
        string avatar_url
        jsonb metadata
        timestamp created_at
    }

    roles {
        uuid id PK
        string name
        string description
    }

    clients {
        uuid id PK
        string name
        string email
        string company
        jsonb metadata
    }

    meetings {
        uuid id PK
        string title
        string zoom_id
        timestamp scheduled_at
        uuid organizer_id FK
    }

    knowledge_entries {
        uuid id PK
        string title
        text content
        uuid author_id FK
        uuid category_id FK
    }

    ai_agents {
        uuid id PK
        string name
        text system_prompt
        jsonb config
    }
```

---

## 🎯 Framework Tiers

```mermaid
graph TB
    subgraph "Tier 1: Must-Have Base"
        T1A[Auth + Route Guards]
        T1B[UI Component Library]
        T1C[Form Handling + Validation]
        T1D[Security XSS Protection]
        T1E[Toast Notifications]
        T1F[Error Boundary]
    end

    subgraph "Tier 2: Commonly Needed"
        T2A[Dashboard Layouts]
        T2B[Caching System]
        T2C[Data Export CSV/PDF]
        T2D[Common Components]
        T2E[Date/Currency Utils]
    end

    subgraph "Tier 3: Optional Add-ons"
        T3A[Email System]
        T3B[Performance Monitoring]
        T3C[Edge Function Integration]
        T3D[Advanced Optimization]
    end

    T1A --> T2A
    T1B --> T2A
    T1C --> T2A
    T1D --> T2A
    T1E --> T2A
    T1F --> T2A

    T2A --> T3A
    T2B --> T3A
    T2C --> T3A
    T2D --> T3A
    T2E --> T3A

    style T1A fill:#ffcdd2
    style T2A fill:#fff9c4
    style T3A fill:#c8e6c9
```

---

## 💡 Key Design Patterns

### **1. Cache-Aside Pattern**
```
Component → Check Cache → Hit? Return : Fetch → Update Cache → Return
```

### **2. Query Key Factory**
```typescript
permissionKeys = {
  all: ['permissions'],
  list: () => ['permissions', 'list'],
  detail: (id) => ['permissions', id]
}
```

### **3. Protected Route Pattern**
```
Request → ProtectedRoute → Auth Check → Allow/Deny
```

### **4. Edge Function Wrapper**
```
Hook → invokeEdgeFunction() → JWT Forward → Function → Response
```

---

## 📈 Scalability Considerations

```mermaid
graph LR
    subgraph "Current V1"
        Small[Small Apps<br/>< 1000 users]
    end

    subgraph "Future Scaling"
        Medium[Medium Apps<br/>1K - 10K users]
        Large[Large Apps<br/>10K+ users]
    end

    Small --> AddCaching[Add Redis Cache]
    AddCaching --> Medium

    Medium --> AddQueue[Add Job Queue]
    AddQueue --> CDN[Add Global CDN]
    CDN --> Large

    Medium --> Optimize[Database Optimization<br/>Indexes, Partitioning]
    Large --> Microservices[Split into Microservices]

    style Small fill:#c8e6c9
    style Medium fill:#fff9c4
    style Large fill:#ffcdd2
```

---

## 🎨 Theming System

```mermaid
graph TB
    CSSVars[CSS Variables<br/>--primary, --secondary, etc.]

    CSSVars --> Tailwind[Tailwind Config<br/>Maps to CSS vars]
    Tailwind --> Components[Components<br/>Use Tailwind classes]

    CSSVars --> DarkMode{Dark Mode?}
    DarkMode -->|Yes| DarkVars[Dark theme values]
    DarkMode -->|No| LightVars[Light theme values]

    Components --> Render[Rendered UI]

    style CSSVars fill:#e3f2fd
    style Render fill:#c8e6c9
```

---

## ✅ Summary

This framework provides:

- ✅ **Modular Architecture** - Easy to add/remove features
- ✅ **Type Safety** - Full TypeScript support
- ✅ **Scalable** - From small apps to enterprise
- ✅ **Secure** - Auth, RLS, XSS protection
- ✅ **Performant** - Caching, optimization, lazy loading
- ✅ **Developer-Friendly** - Clear patterns, documentation

**Use these diagrams to:**
1. Understand the architecture before customizing
2. Explain structure to team members
3. Plan new features
4. Troubleshoot issues

---

For implementation details, see:
- `SJ-DASHBOARD-FRAMEWORK_EXTRACTION_GUIDE.md`
- `SJ-DASHBOARD-FRAMEWORK_SETUP.md`
- `SJ-DASHBOARD-FRAMEWORK_CLEANUP_CHECKLIST.md`
