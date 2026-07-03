import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { logLogin, logLogout } from "@/lib/activity-logger";

interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  // Custom roles (e.g. Loan Processor) are stored in `user_roles.custom_role_id`
  // and resolved against the `roles` table. `role` remains the app_role enum
  // used throughout the app for permission gating.
  customRoleName?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithSSO: (provider: 'google' | 'azure', scopes?: string[]) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  // Fetch user role from user_roles table.
  // Prefer admin/moderator when multiple app roles exist (UNIQUE is per user_id+role).
  const fetchUserRole = async (
    userId: string,
  ): Promise<{ appRole?: string; customRoleName?: string }> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", userId);

      if (error) {
        if (error.code !== "PGRST116") {
          console.error("Error fetching user role:", error);
        }
        return { appRole: undefined, customRoleName: undefined };
      }

      const rows = data ?? [];
      if (rows.length === 0) {
        return { appRole: undefined, customRoleName: undefined };
      }

      const rolePriority = ["admin", "moderator", "user"];
      const roles = rows.map((r) => r.role as string);
      const appRole =
        rolePriority.find((r) => roles.includes(r)) ?? roles[0];

      const preferredRow =
        rows.find((r) => r.role === appRole) ?? rows[0];
      const customRoleId = preferredRow?.custom_role_id;

      if (!customRoleId) {
        return { appRole, customRoleName: undefined };
      }

      const { data: customRole, error: customRoleError } = await supabase
        .from("roles")
        .select("name")
        .eq("id", customRoleId)
        .single();

      if (customRoleError) {
        console.error("Error fetching custom role name:", customRoleError);
        return { appRole, customRoleName: undefined };
      }

      return { appRole, customRoleName: customRole?.name };
    } catch (error) {
      console.error("Error fetching user role:", error);
      return { appRole: undefined, customRoleName: undefined };
    }
  };

  // Fetch or create user profile. Always attach app role from user_roles,
  // even when the profiles row is missing or insert fails (admin access depends on role).
  const fetchProfile = async (userId: string) => {
    try {
      const { appRole, customRoleName } = await fetchUserRole(userId);

      const { data: existing, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (selectError) {
        console.error("Error fetching profile:", selectError);
      }

      if (existing) {
        setProfile({ ...existing, role: appRole, customRoleName });
        return;
      }

      // No profiles row — create one (common for Microsoft/SSO users).
      const authUser = (await supabase.auth.getUser()).data.user;
      const fallbackProfile: Profile = {
        id: userId,
        email: authUser?.email ?? "",
        full_name:
          authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          undefined,
        avatar_url: authUser?.user_metadata?.avatar_url,
        role: appRole,
        customRoleName,
      };

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: fallbackProfile.email || null,
            full_name: fallbackProfile.full_name ?? null,
            avatar_url: fallbackProfile.avatar_url ?? null,
          },
          { onConflict: "id" },
        )
        .select("*")
        .maybeSingle();

      if (createError) {
        console.error("Error creating profile:", createError);
        // Still set in-memory profile so role-based gates (admin) work.
        setProfile(fallbackProfile);
        return;
      }

      setProfile({
        ...(created ?? fallbackProfile),
        role: appRole,
        customRoleName,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Last resort: role-only profile so admin routes can still resolve.
      try {
        const { appRole, customRoleName } = await fetchUserRole(userId);
        const authUser = (await supabase.auth.getUser()).data.user;
        if (authUser) {
          setProfile({
            id: userId,
            email: authUser.email ?? "",
            full_name:
              authUser.user_metadata?.full_name ||
              authUser.user_metadata?.name ||
              undefined,
            role: appRole,
            customRoleName,
          });
        }
      } catch {
        // ignore
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only synchronous state updates here
      setSession(session);
      setUser(session?.user ?? null);
      
      // Defer Supabase calls with setTimeout to prevent deadlock
      if (session?.user) {
        setProfileLoading(true);
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setProfileLoading(true);
        fetchProfile(session.user.id);
      } else {
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    console.log('🔐 [AUTH] Starting sign in for:', email);
    
    try {
      console.log('🔐 [AUTH] Calling supabase.auth.signInWithPassword...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('🔐 [AUTH] Supabase response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        userId: data?.user?.id,
        hasError: !!error,
        errorMessage: error?.message,
        errorStatus: error?.status,
        errorDetails: error
      });
      
      if (error) {
        console.error('❌ [AUTH] Sign in error:', {
          name: error.name,
          message: error.message,
          status: error.status,
          code: (error as any).code,
          fullError: error
        });
        
        // Log failed login attempt
        try {
          await supabase.rpc('log_activity', {
            p_action: 'login_failed',
            p_resource_type: 'auth',
            p_details: { email, method: 'email', success: false, error_message: error.message },
          });
        } catch (logError) {
          console.warn('Failed to log auth event:', logError);
        }
        
        throw error;
      }
      
      console.log('✅ [AUTH] Sign in successful!');
      
      // Log successful login activity
      logLogin("email");
      
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error('❌ [AUTH] Sign in failed - catch block:', authError);
      toast({
        title: "Sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Sign up with email/password
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) throw error;
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign up failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Google sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Sign in with Microsoft (Azure AD) - MSAL-based with new window flow
  const signInWithMicrosoft = async () => {
    try {
      // Try MSAL-based login first if configured
      const msalConfig = await import('@/lib/msalConfig');
      const azureAuth = await import('@/lib/azureAuth');
      
      const configValidation = msalConfig.validateMSALConfig();
      if (configValidation.valid) {
        // Check if we have a stored response from previous auth
        const storedResponse = azureAuth.getStoredMSALResponse();
        if (storedResponse && storedResponse.accessToken) {
          // Complete login with stored response
          const result = await azureAuth.completeAzureLoginFromRedirect();
          if (result?.user) {
            toast({
              title: "Welcome!",
              description: "You've successfully signed in with Microsoft.",
            });
            logLogin("microsoft");
            return;
          }
        }
        
        // Initiate window-based auth flow (works in iframes)
        const authResult = await azureAuth.initiateAzureLoginRedirect();
        if (authResult) {
          // Complete login with the result
          const result = await azureAuth.completeAzureLoginFromRedirect();
          if (result?.user) {
            toast({
              title: "Welcome!",
              description: "You've successfully signed in with Microsoft.",
            });
            logLogin("microsoft");
            return;
          }
        }
        return;
      }
      
      // Fallback to Supabase OAuth if MSAL not configured
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "email profile openid User.Read",
        },
      });
      if (error) throw error;
      
      // Log login activity
      logLogin("microsoft");
    } catch (error: any) {
      const authError = error as AuthError;
      toast({
        title: "Microsoft sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Generic SSO sign in
  const signInWithSSO = async (provider: 'google' | 'azure', scopes?: string[]) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: scopes?.join(' '),
        },
      });
      if (error) throw error;

      // Log SSO login
      logLogin(provider === 'azure' ? 'microsoft' : provider);
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "SSO sign in failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Log logout activity before signing out
      logLogout();
      
      // Check if user is Azure AD user
      const isAzureADUser = localStorage.getItem('isAzureADUser') === 'true';
      
      // Call backend logout endpoint if Azure AD user
      if (isAzureADUser) {
        try {
          const { data: logoutData } = await supabase.functions.invoke('azure-auth-logout', {
            body: {
              isAzureAD: true,
            },
          });
          
          // If logout URL is provided, redirect to Microsoft logout
          if (logoutData?.logoutUrl) {
            // Clear local storage first
            localStorage.clear();
            sessionStorage.clear();
            
            // Redirect to Microsoft logout
            window.location.href = logoutData.logoutUrl;
            return;
          }
        } catch (error) {
          console.error('Error calling logout endpoint:', error);
          // Continue with regular logout
        }
      }
      
      // Clear MSAL cache if Azure AD user
      if (isAzureADUser) {
        try {
          const msalConfig = await import('@/lib/msalConfig');
          const msalInstance = await msalConfig.getMSALInstance();
          await msalInstance.logoutPopup();
        } catch (error) {
          console.error('Error logging out from MSAL:', error);
          // Continue with regular logout
        }
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();
      
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign out failed",
        description: authError.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update failed",
        description: "Failed to update profile.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    profileLoading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithSSO,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
