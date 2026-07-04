/**
 * Query key factories for React Query
 * Provides consistent cache keys across the application
 */

export const queryKeys = {
  // Auth
  auth: {
    user: ["auth", "user"] as const,
    session: ["auth", "session"] as const,
  },

  // Clients
  clients: {
    all: ["clients"] as const,
    list: (filters?: Record<string, any>) => ["clients", "list", filters] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
  },

  // Meetings
  meetings: {
    all: ["meetings"] as const,
    list: (filters?: Record<string, any>) => ["meetings", "list", filters] as const,
    detail: (id: string) => ["meetings", "detail", id] as const,
    zoom: (meetingId: string) => ["meetings", "zoom", meetingId] as const,
  },

  // Knowledge Base
  knowledge: {
    all: ["knowledge"] as const,
    entries: (filters?: Record<string, any>) => ["knowledge", "entries", filters] as const,
    entry: (id: string) => ["knowledge", "entry", id] as const,
    documentExtract: (knowledgeEntryId: string) =>
      ["knowledge", "document-extract", knowledgeEntryId] as const,
    categories: ["knowledge", "categories"] as const,
    category: (id: string) => ["knowledge", "category", id] as const,
    search: (query: string) => ["knowledge", "search", query] as const,
  },

  // Tasks
  tasks: {
    all: ["tasks"] as const,
    list: (filters?: Record<string, any>) => ["tasks", "list", filters] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },

  // AI
  ai: {
    agents: ["ai", "agents"] as const,
    agent: (id: string) => ["ai", "agent", id] as const,
    runs: (agentId: string) => ["ai", "runs", agentId] as const,
    chat: (sessionId: string) => ["ai", "chat", sessionId] as const,
    embeddings: (sourceId: string) => ["ai", "embeddings", sourceId] as const,
    conversations: (agentId: string, userId: string) =>
      ["ai", "conversations", agentId, userId] as const,
    messages: (conversationId: string) => ["ai", "messages", conversationId] as const,
    memories: (agentId: string, scopeKey: string) => ["ai", "memories", agentId, scopeKey] as const,
  },

  // Admin
  admin: {
    users: ["admin", "users"] as const,
    user: (id: string) => ["admin", "user", id] as const,
    roles: ["admin", "roles"] as const,
    permissions: ["admin", "permissions"] as const,
    userPermissionSettings: (userId: string) =>
      ["admin", "userPermissionSettings", userId] as const,
    moduleSettings: ["admin", "moduleSettings"] as const,
  },

  // Email Intelligence (Gmail)
  emailIntelligence: {
    connection: ["email-intelligence", "connection"] as const,
    messages: (filters?: Record<string, unknown>) =>
      ["email-intelligence", "messages", filters] as const,
    attachments: (messageId: string) => ["email-intelligence", "attachments", messageId] as const,
  },

  // Loans (when module enabled)
  loans: {
    all: ["loans"] as const,
    list: (filters?: Record<string, unknown>) => ["loans", "list", filters] as const,
    detail: (id: string) => ["loans", "detail", id] as const,
  },
  loanRiskAnalyses: {
    all: ["loan_risk_analyses"] as const,
    byLoan: (loanId: string) => ["loan_risk_analyses", loanId] as const,
    dashboard: ["loan_risk_analyses", "dashboard"] as const,
  },
  loanRiskChat: {
    all: ["loan_risk_chat_messages"] as const,
    byLoan: (loanId: string) => ["loan_risk_chat_messages", loanId] as const,
  },
  borrowers: {
    all: ["borrowers"] as const,
    list: (filters?: Record<string, unknown>) => ["borrowers", "list", filters] as const,
    detail: (id: string) => ["borrowers", "detail", id] as const,
  },

  // Notifications
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
    count: ["notifications", "count"] as const,
  },

  // Risk alerts
  riskAlerts: {
    all: ["riskAlerts"] as const,
    unread: ["riskAlerts", "unread"] as const,
    byLoan: (loanId: string) => ["riskAlerts", "byLoan", loanId] as const,
  },

  // SLA
  slaConfigurations: {
    all: ["slaConfigurations"] as const,
  },

  // Action items
  actionItems: {
    all: ["actionItems"] as const,
    byView: (view: string) => ["actionItems", view] as const,
    detail: (id: string) => ["actionItems", "detail", id] as const,
  },

  /** Unified operations calendar (multi-source aggregation). */
  calendar: {
    unified: (rangeKey: string, sourcesKey: string, outlook: boolean) =>
      ["calendar", "unified", rangeKey, sourcesKey, outlook] as const,
  },

  borrowerCommunications: {
    all: ["borrowerCommunications"] as const,
    list: (userId: string) => ["borrowerCommunications", "list", userId] as const,
    detail: (id: string) => ["borrowerCommunications", "detail", id] as const,
  },

  // Pricing & Rate Lock
  pricing: {
    rateSheets: {
      all: ["pricing", "rateSheets"] as const,
      active: ["pricing", "rateSheets", "active"] as const,
    },
    datastores: {
      all: ["pricing", "datastores"] as const,
    },
    calculator: {
      results: (key: string) => ["pricing", "calculator", "results", key] as const,
    },
    locks: {
      byLoan: (loanId: string) => ["pricing", "locks", "byLoan", loanId] as const,
      scoped: ["pricing", "locks", "scoped"] as const,
    },
    lockAlerts: {
      all: ["pricing", "lockAlerts"] as const,
      byLoan: (loanId: string) => ["pricing", "lockAlerts", "byLoan", loanId] as const,
    },
    pricingSnapshot: (loanId: string) => ["pricing", "pricingSnapshot", loanId] as const,
    investorByLoan: (loanId: string) => ["pricing", "investor", loanId] as const,
    investorSubmissionsScoped: ["pricing", "investorSubmissions", "scoped"] as const,
  },
  /** Phase 5 — closing & digital execution (manual tables per loan). */
  closing: {
    settlementOrders: (loanId: string) => ["closing", "settlementOrders", loanId] as const,
    appraisalOrders: (loanId: string) => ["closing", "appraisalOrders", loanId] as const,
    ronSessions: (loanId: string) => ["closing", "ronSessions", loanId] as const,
    digitalClosing: (loanId: string) => ["closing", "digitalClosing", loanId] as const,
    adverseActions: (loanId: string) => ["closing", "adverseActions", loanId] as const,
  },
  /** Phase 7 — compliance reporting and licensing. */
  phase7: {
    hmdaByLoan: (loanId: string) => ["phase7", "hmda", "loan", loanId] as const,
    hmdaByYear: (year: number) => ["phase7", "hmda", "year", year] as const,
    hmdaByYearAll: ["phase7", "hmda", "year"] as const,
    hmdaReportRuns: ["phase7", "hmda", "reportRuns"] as const,
    nmlsLicenses: (search: string) => ["phase7", "nmls", "licenses", search] as const,
  },
  hedge: {
    snapshots: ["hedge", "snapshots"] as const,
    assumptions: ["hedge", "assumptions"] as const,
  },
};

/**
 * Cache configuration
 */
export const cacheConfig = {
  staleTime: {
    short: 1000 * 60, // 1 minute
    medium: 1000 * 60 * 5, // 5 minutes
    long: 1000 * 60 * 30, // 30 minutes
    veryLong: 1000 * 60 * 60, // 1 hour
  },
  gcTime: {
    short: 1000 * 60 * 5, // 5 minutes
    medium: 1000 * 60 * 10, // 10 minutes
    long: 1000 * 60 * 30, // 30 minutes
  },
};

/**
 * Cache invalidation helpers
 */
export const invalidateKeys = {
  clients: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
  },
  meetings: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
  },
  knowledge: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
  },
  tasks: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  },
  roles: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
  },
  userPermissionSettings: (queryClient: any, userId?: string) => {
    if (userId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.userPermissionSettings(userId),
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: ["admin", "userPermissionSettings"],
      });
    }
  },
  ai: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
  },
  notifications: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  },
  moduleSettings: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.moduleSettings });
  },
  loans: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
  },
  managerDashboard: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: ["manager-dashboard"] });
  },
  borrowers: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.borrowers.all });
  },
  riskAlerts: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.riskAlerts.all });
  },
  actionItems: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.actionItems.all });
  },
  borrowerCommunications: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.borrowerCommunications.all });
  },
};
