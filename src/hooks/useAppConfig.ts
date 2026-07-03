import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface AppConfig {
  // Branding
  branding: {
    companyName: string;
    tagline: string;
    supportEmail: string;
    logoUrl?: string;
  };
  // Features
  features: {
    enableAIChat: boolean;
    enableKnowledgeBase: boolean;
    enableMeetings: boolean;
    enableTasks: boolean;
    enableNotifications: boolean;
    enableSemanticSearch: boolean;
    enableClients: boolean;
    enableAIAgents: boolean;
    enablePersonalKnowledge: boolean;
    enableFeedback: boolean;
    enableGoogleDrive: boolean;
    enableZoomSync: boolean;
  };
  // Email
  email: {
    enableEmailNotifications: boolean;
    fromName: string;
    fromEmail: string;
  };
  // System
  system: {
    maintenanceMode: boolean;
    allowSignups: boolean;
    requireEmailVerification: boolean;
    sessionTimeout: number;
    onboardingCompleted?: boolean;
    templateDataSeeded?: boolean;
  };
}

// Default configuration to use until app_config table is created
const DEFAULT_CONFIG: AppConfig = {
  branding: {
    companyName: "Control Tower",
    tagline: "AI-Powered Mortgage Management",
    supportEmail: "support@example.com",
    logoUrl: "",
  },
  features: {
    enableAIChat: true,
    enableKnowledgeBase: true,
    enableMeetings: true,
    enableTasks: true,
    enableNotifications: true,
    enableSemanticSearch: true,
    enableClients: true,
    enableAIAgents: true,
    enablePersonalKnowledge: true,
    enableFeedback: true,
    enableGoogleDrive: false,
    enableZoomSync: true,
  },
  email: {
    enableEmailNotifications: false,
    fromName: "Control Tower",
    fromEmail: "noreply@example.com",
  },
  system: {
    maintenanceMode: false,
    allowSignups: true,
    requireEmailVerification: false,
    sessionTimeout: 3600,
    onboardingCompleted: false,
    templateDataSeeded: false,
  },
};

// Note: app_config table needs to be created in the database schema
// These hooks return default data until the table is created

// Fetch all app configuration - returns default config until table exists
export function useAppConfig() {
  return useQuery({
    queryKey: ["app_config"],
    queryFn: async () => {
      // Table not yet created - return default config
      return DEFAULT_CONFIG;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Update app configuration - disabled until table exists
export function useUpdateAppConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: AppConfig) => {
      // Table not yet created
      toast.error("App configuration requires database migration");
      throw new Error("app_config table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] });
      toast.success("Configuration updated successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to update config:", error);
    },
  });
}

// Update a single config value - disabled until table exists
export function useUpdateConfigValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
      category,
    }: {
      key: string;
      value: any;
      category: string;
    }) => {
      // Table not yet created
      console.warn("Config update skipped - app_config table not yet created");
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] });
    },
    onError: (error: Error) => {
      console.error("Failed to update config value:", error);
    },
  });
}

// Reset app configuration to defaults - disabled until table exists
export function useResetAppConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Table not yet created
      console.warn("Config reset skipped - app_config table not yet created");
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] });
      toast.success("Configuration reset to defaults");
    },
    onError: (error: Error) => {
      console.error("Failed to reset config:", error);
      toast.error("Failed to reset configuration");
    },
  });
}
