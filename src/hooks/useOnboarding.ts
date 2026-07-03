import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      setLoading(true);

      // Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Note: app_config table not yet created
      // Check profile only for now
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .single();

      const hasProfile = profile?.full_name && profile.full_name.trim() !== "";

      // Show onboarding if profile is incomplete
      setShowOnboarding(!hasProfile);
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      // On error, assume onboarding is not needed
      setShowOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;

    try {
      // Mark onboarding as completed (just update local state for now)
      // Note: app_config table not yet created
      console.log("Onboarding completed for user:", user.id);
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const skipOnboarding = () => {
    setShowOnboarding(false);
  };

  return {
    showOnboarding,
    loading,
    user,
    completeOnboarding,
    skipOnboarding,
  };
}
