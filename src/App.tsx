import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

/** Redirect to a path, keeping ?query (e.g. loanId) for deep links. */
function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { CalendarRoleRoute } from "@/components/routing/CalendarRoleRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DocsLayout } from "@/components/layout/DocsLayout";
import { permissionKey } from "@/lib/permissions";

// Public pages
// Index landing page removed — `/` now redirects to /login.
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import MicrosoftAuthCallback from "./pages/MicrosoftAuthCallback";
import NotFound from "./pages/NotFound";
import EnvDebug from "./pages/EnvDebug";
import PublicPrequalCalculator from "./pages/PublicPrequalCalculator";
import MortgageCalculatorWidget from "./pages/MortgageCalculatorWidget";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalRedeem from "./pages/portal/PortalRedeem";
import PortalDashboard from "./pages/portal/PortalDashboard";

// Protected pages
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import ClientDetail from "./pages/ClientDetail";
import Meetings from "./pages/Meetings";
import MeetingForm from "./pages/MeetingForm";
import { MeetingFormErrorBoundary } from "@/components/MeetingFormErrorBoundary";
import MeetingDetail from "./pages/MeetingDetail";
import Knowledge from "./pages/Knowledge";
import KnowledgeForm from "./pages/KnowledgeForm";
import KnowledgeDetail from "./pages/KnowledgeDetail";
import KnowledgeUpload from "./pages/KnowledgeUpload";
import KnowledgeByCategory from "./pages/KnowledgeByCategory";
import AIChat from "./pages/AIChat";
import Admin from "./pages/Admin";
import DeploymentStatus from "./pages/DeploymentStatus";
import UserManagement from "./pages/admin/UserManagement";
import RoleManagement from "./pages/admin/RoleManagement";
import ActivityLogs from "./pages/admin/ActivityLogs";
import SystemSettings from "./pages/admin/SystemSettings";
import Integrations from "./pages/admin/Integrations";
import ProviderDetail from "./pages/admin/ProviderDetail";
import OAuthCallback from "./pages/admin/OAuthCallback";
import AIModelManagement from "./pages/admin/AIModelManagement";
import LLMConfig from "./pages/admin/ai/LLMConfig";
import AIUsageAnalytics from "./pages/admin/AIUsageAnalytics";
import DeploymentChecklist from "./pages/admin/DeploymentChecklist";
import FeedbackManagement from "./pages/admin/FeedbackManagement";
import ModuleManagement from "./pages/admin/ModuleManagement";
import KnowledgeCategories from "./pages/admin/KnowledgeCategories";
import KnowledgeAnalytics from "./pages/admin/KnowledgeAnalytics";
import DocumentExtracts from "./pages/admin/DocumentExtracts";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Feedback from "./pages/Feedback";
import AIAgents from "./pages/AIAgents";
import AgentChat from "./pages/AgentChat";
import Tasks from "./pages/Tasks";
import TaskForm from "./pages/TaskForm";
import TaskDetail from "./pages/TaskDetail";
import PersonalKnowledge from "./pages/PersonalKnowledge";
import Loans from "./pages/Loans";
import LoanDetail from "./pages/LoanDetail";
import LoanForm from "./pages/LoanForm";
import LoanImport from "./pages/LoanImport";
import MortgageRiskDashboard from "./pages/MortgageRiskDashboard";
import Borrowers from "./pages/Borrowers";
import BorrowerDetail from "./pages/BorrowerDetail";
import BorrowerForm from "./pages/BorrowerForm";
import ActionItems from "./pages/ActionItems";
import CommunicationCenter from "./pages/CommunicationCenter";
import EmailIntelligence from "./pages/EmailIntelligence";
import EmailIntelligenceCallback from "./pages/EmailIntelligenceCallback";
import PipelinePlaceholder from "./pages/PipelinePlaceholder";
import PipelineEncompass from "./pages/PipelineEncompass";
import AgentsBrowse from "./pages/AgentsBrowse";
import AgentDetail from "./pages/AgentDetail";
import OperationsCalendar from "./pages/OperationsCalendar";
import UnderwritingQueue from "./pages/UnderwritingQueue";
import DocumentReviewQueue from "./pages/DocumentReviewQueue";

// Admin docs pages
import ProductVision from "./pages/admin/docs/ProductVision";
import ProductBacklog from "./pages/admin/docs/ProductBacklog";
import TechnicalGuide from "./pages/admin/docs/TechnicalGuide";
import Roadmap from "./pages/admin/docs/Roadmap";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/home" element={<Navigate to="/login" replace />} />
            <Route path="/pricing-public" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth-callback" element={<MicrosoftAuthCallback />} />
            <Route path="/env-debug" element={<EnvDebug />} />
            <Route path="/prequal-public" element={<PublicPrequalCalculator />} />
            <Route path="/mortgage-calculator-widget" element={<MortgageCalculatorWidget />} />

            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalRedeem />} />
              <Route path="dashboard" element={<PortalDashboard />} />
            </Route>

            {/* Public Developer Docs */}
            <Route
              path="/docs/vision"
              element={
                <DocsLayout>
                  <ProductVision />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/backlog"
              element={
                <DocsLayout>
                  <ProductBacklog />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/technical"
              element={
                <DocsLayout>
                  <TechnicalGuide />
                </DocsLayout>
              }
            />
            <Route
              path="/docs/roadmap"
              element={
                <DocsLayout>
                  <Roadmap />
                </DocsLayout>
              }
            />

            {/* Protected routes with dashboard layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                {/* Pipeline views — gated behind module flag for Lite */}
                <Route element={<ModuleRoute requiresModule="pipeline_views" />}>
                  <Route path="/pipeline" element={<Navigate to="/pipeline/hubspot" replace />} />
                  <Route path="/pipeline/hubspot" element={<PipelinePlaceholder />} />
                  <Route path="/pipeline/encompass" element={<PipelineEncompass />} />
                  <Route path="/manager" element={<Navigate to="/pipeline" replace />} />
                </Route>

                {/* Clients */}
                <Route element={<ModuleRoute requiredPermission="clients:read" />}>
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/new" element={<ClientForm />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/clients/:id/edit" element={<ClientForm />} />
                </Route>

                {/* Meetings */}
                <Route element={<ModuleRoute requiresFeatureFlag="enableMeetings" requiredPermission="meetings:read" />}>
                  <Route path="/meetings" element={<Meetings />} />
                  <Route path="/meetings/new" element={<MeetingFormErrorBoundary><MeetingForm /></MeetingFormErrorBoundary>} />
                  <Route path="/meetings/:id/edit" element={<MeetingFormErrorBoundary><MeetingForm /></MeetingFormErrorBoundary>} />
                  <Route path="/meetings/:id" element={<MeetingDetail />} />
                </Route>

                {/* Tasks */}
                <Route element={<ModuleRoute requiresFeatureFlag="enableTasks" requiredPermission="tasks:read" />}>
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/tasks/new" element={<TaskForm />} />
                  <Route path="/tasks/:id" element={<TaskDetail />} />
                  <Route path="/tasks/:id/edit" element={<TaskForm />} />
                </Route>

                {/* Knowledge Base */}
                <Route element={<ModuleRoute requiresFeatureFlag="enableKnowledgeBase" requiredPermission="knowledge:read" />}>
                  <Route path="/knowledge" element={<Knowledge />} />
                  <Route path="/knowledge/upload" element={<KnowledgeUpload />} />
                  <Route path="/knowledge/personal" element={<PersonalKnowledge />} />
                  <Route path="/knowledge/category/:slug" element={<KnowledgeByCategory />} />
                  <Route path="/knowledge/new" element={<KnowledgeForm />} />
                  <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
                  <Route path="/knowledge/:id/edit" element={<KnowledgeForm />} />
                </Route>

                {/* Loans (gated by Module Management + permission) */}
                <Route element={<ModuleRoute requiresModule="loans" requiredPermission="loans:read" />}>
                  <Route path="/loans" element={<Loans />} />
                  <Route path="/loans/new" element={<LoanForm />} />
                  <Route
                    element={
                      <ModuleRoute
                        requiresModule="mortgage_risk_copilot"
                        requiredPermission={permissionKey("loan_risk_analyses", "read")}
                      />
                    }
                  >
                    <Route path="/loans/risk-dashboard" element={<MortgageRiskDashboard />} />
                  </Route>
                  <Route path="/loans/:id" element={<LoanDetail />} />
                  <Route path="/loans/:id/edit" element={<LoanForm />} />
                </Route>

                {/* Communication Center / Email Intelligence — Lite-hidden */}
                <Route element={<ModuleRoute requiresModule="communication_center" />}>
                  <Route path="/communication-center" element={<CommunicationCenter />} />
                  <Route
                    path="/document-generation"
                    element={<RedirectWithSearch to="/communication-center" />}
                  />
                  <Route
                    path="/communications"
                    element={<RedirectWithSearch to="/communication-center" />}
                  />
                </Route>

                {/* Email Intelligence — Lite-hidden */}
                <Route element={<ModuleRoute requiresModule="email_intelligence" />}>
                  <Route path="/email-intelligence" element={<EmailIntelligence />} />
                  <Route path="/email-intelligence/callback" element={<EmailIntelligenceCallback />} />
                </Route>

                <Route element={<ModuleRoute requiresModule="loans" requiredPermission="loans:import" />}>
                  <Route path="/loans/import" element={<LoanImport />} />
                </Route>

                {/* Underwriting Queue — Lite-hidden */}
                <Route element={<ModuleRoute requiresModule="underwriting_queue" requiredPermission="loans:read" />}>
                  <Route path="/underwriting" element={<UnderwritingQueue />} />
                </Route>

                {/* Document Review Queue — Lite-hidden */}
                <Route element={<ModuleRoute requiresModule="document_review" requiredPermission="loans:read" />}>
                  <Route path="/documents/review" element={<DocumentReviewQueue />} />
                </Route>

                {/* Operations calendar — admin, loan officer, branch manager only */}
                <Route element={<CalendarRoleRoute />}>
                  <Route element={<ModuleRoute requiresModule="loans" requiredPermission={permissionKey("loans", "read")} />}>
                    <Route path="/calendar" element={<OperationsCalendar />} />
                  </Route>
                </Route>

                {/* Borrowers (same module) */}
                <Route element={<ModuleRoute requiresModule="loans" requiredPermission="borrowers:read" />}>
                  <Route path="/borrowers" element={<Borrowers />} />
                  <Route path="/borrowers/new" element={<BorrowerForm />} />
                  <Route path="/borrowers/:id" element={<BorrowerDetail />} />
                  <Route path="/borrowers/:id/edit" element={<BorrowerForm />} />
                </Route>

                {/* Pricing / Quick Pricer / Rate Sheet modules disabled for all roles */}
                <Route path="/pricing" element={<Navigate to="/dashboard" replace />} />
                <Route path="/pricing/*" element={<Navigate to="/dashboard" replace />} />

                {/* AI Agent Browse + per-agent chat for all authenticated users */}
                <Route element={<ModuleRoute requiresFeatureFlag="enableAIAgents" />}>
                  <Route path="/agents" element={<AgentsBrowse />} />
                  <Route path="/agents/:slug" element={<AgentDetail />} />
                  <Route path="/agents/:agentId/chat" element={<AgentChat />} />
                </Route>

                {/* Action Items (gated by agent enabled in component) */}
                <Route path="/action-items" element={<ActionItems />} />

                {/* User Pages */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route element={<ModuleRoute requiresFeatureFlag="enableNotifications" />}>
                  <Route path="/notifications" element={<Notifications />} />
                </Route>
                <Route element={<ModuleRoute requiresFeatureFlag="enableFeedback" />}>
                  <Route path="/feedback" element={<Feedback />} />
                </Route>

                {/* AI chat route (permission-controlled and feature-flagged) */}
                <Route
                  element={
                    <ModuleRoute
                      requiresFeatureFlag="enableAIChat"
                      requiredPermission={permissionKey("ai_chat", "read")}
                    />
                  }
                >
                  <Route path="/ai" element={<AIChat />} />
                  <Route path="/ai/chat" element={<AIChat />} />
                </Route>

                {/* Admin-only AI agent management routes */}
                <Route element={<AdminRoute />}>
                  <Route element={<ModuleRoute requiresFeatureFlag="enableAIChat" />}>
                    <Route path="/ai/agents" element={<AIAgents />} />
                    <Route path="/ai/agents/:agentId/chat" element={<AgentChat />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* Admin Panel routes with dedicated admin layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/admin/users" element={<UserManagement />} />
                  <Route path="/admin/roles" element={<RoleManagement />} />
                  <Route path="/admin/logs" element={<ActivityLogs />} />
                  <Route path="/admin/settings" element={<SystemSettings />} />
                  <Route path="/admin/integrations" element={<Integrations />} />
                  <Route path="/admin/integrations/oauth/callback" element={<OAuthCallback />} />
                  <Route path="/admin/integrations/:slug" element={<ProviderDetail />} />
                  <Route path="/admin/ai/llm-config" element={<LLMConfig />} />
                  <Route path="/admin/ai-models" element={<Navigate to="/admin/ai/llm-config" replace />} />
                  <Route path="/admin/ai-usage" element={<AIUsageAnalytics />} />
                  <Route path="/admin/agents" element={<AIAgents />} />
                  <Route path="/admin/agents/:agentId/chat" element={<AgentChat />} />
                  <Route path="/admin/feedback" element={<FeedbackManagement />} />
                  <Route path="/admin/checklist" element={<DeploymentChecklist />} />
                  <Route path="/admin/knowledge-categories" element={<KnowledgeCategories />} />
                  <Route path="/admin/knowledge-analytics" element={<KnowledgeAnalytics />} />
                  <Route path="/admin/knowledge-documents" element={<DocumentExtracts />} />
                  <Route path="/admin/modules" element={<ModuleManagement />} />
                  {/* Redirect removed Lite pages to admin home */}
                  <Route path="/admin/loan-programs" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/sso-settings" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/cronjobs" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/cronjob-logs" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/hmda-reporting" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/licensing-tracker" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/meeting-analytics" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/environment" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/onboarding" element={<Navigate to="/admin" replace />} />
                </Route>
              </Route>
            </Route>

            {/* Full-screen agent chat only (AI Chat /ai uses DashboardLayout with sidebar) */}
            {/* 404 catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BrandingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
