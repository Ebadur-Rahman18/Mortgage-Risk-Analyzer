import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type ActivityAction = 
  | "login" 
  | "logout" 
  | "create" 
  | "update" 
  | "delete" 
  | "view" 
  | "access";

export type ResourceType = 
  | "loan"
  | "loan_risk_analysis"
  | "rate_lock"
  | "document"
  | "rate_sheet"
  | "action_item"
  | "pipeline"
  | "agent"
  | "client" 
  | "meeting" 
  | "knowledge" 
  | "task" 
  | "user" 
  | "role"
  | "feedback"
  | "ai_chat" 
  | "settings"
  | null;

interface LogActivityParams {
  action: ActivityAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, Json>;
}

/**
 * Log user activity to the activity_logs table
 * This is a fire-and-forget operation - errors are logged but don't throw
 */
export async function logActivity({
  action,
  resourceType = null,
  resourceId,
  details = {},
}: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("Cannot log activity: No authenticated user");
      return;
    }

    // Try to insert into activity_logs table
    const { error } = await supabase
      .from("activity_logs")
      .insert({
        user_id: user.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: details as any,
        ip_address: null, // Could be enhanced with IP detection
        user_agent: navigator.userAgent,
      });

    if (error) {
      // Table might not exist yet - log to console as fallback
      console.warn("[Activity Log - Fallback]", { 
        action, 
        resourceType, 
        resourceId, 
        details, 
        userId: user.id,
        error: error.message 
      });
    } else {
      console.log("[Activity Logged]", { action, resourceType, resourceId });
    }
  } catch (error) {
    console.error("Activity logging error:", error);
  }
}

/**
 * Helper to log login activity
 */
export function logLogin(method: string = "email"): void {
  logActivity({
    action: "login",
    details: { method },
  });
}

/**
 * Helper to log logout activity
 */
export function logLogout(): void {
  logActivity({
    action: "logout",
  });
}

/**
 * Helper to log CRUD operations
 */
export function logCrud(
  action: "create" | "update" | "delete",
  resourceType: ResourceType,
  resourceId: string,
  details?: Record<string, Json>
): void {
  logActivity({
    action,
    resourceType,
    resourceId,
    details,
  });
}

/**
 * Helper to log client operations
 */
export function logClientAction(
  action: "create" | "update" | "delete",
  clientId: string,
  clientName?: string
): void {
  logCrud(action, "client", clientId, { name: clientName });
}

/**
 * Helper to log meeting operations
 */
export function logMeetingAction(
  action: "create" | "update" | "delete",
  meetingId: string,
  meetingTitle?: string
): void {
  logCrud(action, "meeting", meetingId, { title: meetingTitle });
}

/**
 * Helper to log task operations
 */
export function logTaskAction(
  action: "create" | "update" | "delete",
  taskId: string,
  taskTitle?: string
): void {
  logCrud(action, "task", taskId, { title: taskTitle });
}

/**
 * Helper to log knowledge operations
 */
export function logKnowledgeAction(
  action: "create" | "update" | "delete" | "view",
  knowledgeId: string,
  title?: string
): void {
  logActivity({
    action,
    resourceType: "knowledge",
    resourceId: knowledgeId,
    details: { title },
  });
}

/**
 * Helper to log user role changes
 */
export function logRoleChange(
  action: "create" | "delete",
  userId: string,
  role: string
): void {
  logCrud(action, "role", userId, { role });
}

/**
 * Helper to log user management actions
 */
export function logUserAction(
  action: "create" | "update" | "delete",
  userId: string,
  email?: string
): void {
  logCrud(action, "user", userId, { email });
}

/**
 * Helper to log feedback operations
 */
export function logFeedbackAction(
  action: "create" | "update" | "delete",
  feedbackId: string,
  type?: string
): void {
  logCrud(action, "feedback", feedbackId, { type });
}
