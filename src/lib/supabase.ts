// Re-export the shared Supabase client.
//
// MCT Lite: many legacy hooks reference tables that exist in the original
// Mortgage Control Tower schema but were intentionally NOT migrated to the
// Lite database (phase3/5/7, AI agents, pricing, compliance, meetings, etc).
// Those hooks live behind feature-flagged routes and will not be reached at
// runtime, but they still need to type-check. We cast the client to `any` here
// so the legacy hooks compile without us having to stub every file.
//
// Code paths that are part of the active 8 Lite modules (Auth, Dashboard,
// Loans, Borrowers, Tasks, Knowledge, AI Chat, Notifications, Admin) should
// import the strongly-typed client directly from `@/integrations/supabase/client`.
import { supabase as typedClient } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = typedClient;
