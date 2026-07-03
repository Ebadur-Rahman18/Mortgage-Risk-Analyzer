import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopNav } from "./TopNav";
import OnboardingWizard from "@/components/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";
import { cn } from "@/lib/utils";
import { ContactCollabAIButton } from "@/components/ContactCollabAIButton";
import { useTour } from "@/hooks/useTour";
import { TourProvider } from "@/contexts/TourContext";
import { AppTour } from "@/components/tour/AppTour";
import { useAuth } from "@/contexts/AuthContext";
import { getNormalizedUserRoles } from "@/lib/agentRoles";
import type { TourVariant } from "@/components/tour/tourSteps";

function isChatRoute(pathname: string) {
  return pathname === "/ai" || pathname === "/ai/chat" || /^\/ai\/agents\/[^/]+\/chat$/.test(pathname);
}

function DashboardLayoutContent() {
  const { showOnboarding, loading, completeOnboarding, skipOnboarding } =
    useOnboarding();
  const sidebar = useAppSidebar();
  const collapsed = sidebar?.collapsed ?? false;
  const location = useLocation();
  const noRightPadding = isChatRoute(location.pathname);

  const { user, profile } = useAuth();
  const tour = useTour(user?.id);

  const normalizedRoles = getNormalizedUserRoles(profile);
  const isAdmin = profile?.role === "admin" || profile?.role === "moderator";
  const isLoanOfficer =
    !isAdmin &&
    (normalizedRoles.has("loan_officer") || normalizedRoles.has("branch_manager"));
  const tourVariant: TourVariant = isAdmin
    ? "admin"
    : isLoanOfficer
    ? "loan_officer"
    : "user";

  return (
    <TourProvider value={tour}>
      <div
        className={cn(
          "bg-background",
          isChatRoute(location.pathname) ? "h-screen overflow-hidden" : "min-h-screen"
        )}
      >
        <AppSidebar />
        <TopNav />
        <main
          className={cn(
            "mt-16 min-h-[calc(100vh-4rem)] p-6 lg:p-8 transition-[margin-left] duration-200 ease-in-out",
            collapsed ? "ml-16" : "ml-64",
            noRightPadding &&
              "pr-0 lg:pr-0 h-[calc(100vh-4rem)] overflow-hidden"
          )}
        >
          <Outlet />
        </main>

        {/* Onboarding Wizard */}
        {!loading && showOnboarding && (
          <OnboardingWizard
            open={showOnboarding}
            onClose={skipOnboarding}
            onComplete={completeOnboarding}
          />
        )}

        <AppTour tour={tour} variant={tourVariant} />
        <ContactCollabAIButton />
      </div>
    </TourProvider>
  );
}

export function DashboardLayout() {
  return (
    <AppSidebarProvider>
      <DashboardLayoutContent />
    </AppSidebarProvider>
  );
}
