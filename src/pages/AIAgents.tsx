import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { FileRiskAgentPanel } from "@/components/loans/FileRiskAgentPanel";
import { AgentUserGuideDialog } from "@/components/agents/AgentUserGuideDialog";
import {
  QuickStartWizard,
  AgentCategoryGuide,
  SystemPromptGuide,
  MemorySystemGuide,
  MultiAgentCollaborationInfo,
  HITLApprovalInfo,
} from "@/components/admin/AgentConfigurationGuide";
import {
  useAIAgents,
  useCreateAgent,
  useUpdateAgent,
  useToggleAgent,
  useDeleteAgent,
  useRunAgent,
  useAgentRuns,
  AIAgent,
  AgentFormData,
  AgentProviderConfig,
  AgentMetadata,
} from "@/hooks/useAIAgents";
import { useKnowledgeEntries, useKnowledgeCategories } from "@/hooks/useKnowledge";
import {
  type LlmProvider,
  LLM_PROVIDER_OPTIONS,
  AI_MODELS_BY_PROVIDER,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_AGENT_LLM_PROVIDER,
  getDefaultModelForProvider,
  resolveLlmProviderFromConfig,
} from "@/lib/aiAgentProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Brain,
  Loader2,
  Plus,
  Edit,
  Trash2,
  History,
  MessageSquare,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Globe,
  Zap,
  Search,
  BarChart2,
  Bot,
  ShieldAlert,
  ArrowLeft,
  BookOpen,
} from "lucide-react";

// ─── Avatar options ───────────────────────────────────────────────────────────
const AVATAR_OPTIONS = [
  "🤖", "🧠", "💡", "🔍", "📊", "🎨", "⚡", "🚀",
  "💻", "📈", "🔬", "🎯", "⚙️", "🌐", "🔐", "📝",
  "🏆", "🔌", "🔧", "🧩",
];

// ─── Tool definitions for Step 3 ──────────────────────────────────────────────
const TOOL_IDS = ["web_search", "knowledge_base", "data_analysis", "integrations", "code_execution"] as const;

// ─── Extended local form state ────────────────────────────────────────────────
interface ExtendedFormData extends AgentFormData {
  provider: LlmProvider;
  avatar: string;
  is_public: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: Record<string, boolean>;
  /** When Knowledge Base tool is enabled: optional entry IDs to scope search. */
  knowledge_entry_ids: string[];
  knowledge_category_ids: string[];
  /** Comma-separated roles for custom agents; empty = all authenticated users. */
  required_role_input: string;
}

const DEFAULT_FORM: ExtendedFormData = {
  name: "",
  slug: "",
  description: "",
  category: "general",
  system_prompt: "You are a helpful AI assistant.",
  is_enabled: true,
  memory_enabled: false,
  provider: DEFAULT_AGENT_LLM_PROVIDER,
  avatar: "🤖",
  is_public: false,
  model: getDefaultModelForProvider(DEFAULT_AGENT_LLM_PROVIDER),
  temperature: 0.7,
  max_tokens: 4096,
  tools: Object.fromEntries(TOOL_IDS.map((id) => [id, false])),
  knowledge_entry_ids: [],
  knowledge_category_ids: [],
  required_role_input: "",
};

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  general: { label: "General", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  communication: { label: "Communication", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  analysis: { label: "Data Analysis", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  task_management: { label: "Task Management", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

export default function AIAgents() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agents, isLoading } = useAIAgents();
  const { data: recentRuns } = useAgentRuns();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const toggleAgent = useToggleAgent();
  const deleteAgent = useDeleteAgent();
  const runAgent = useRunAgent();

  // ── View mode ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [runInput, setRunInput] = useState("");
  const [fileRiskPanelOpen, setFileRiskPanelOpen] = useState(false);
  const [guideAgent, setGuideAgent] = useState<AIAgent | null>(null);

  // ── Multi-step form ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 3;

  const [formData, setFormData] = useState<ExtendedFormData>(DEFAULT_FORM);
  const [knowledgeScopeFilter, setKnowledgeScopeFilter] = useState("");

  const { data: scopeEntries = [] } = useKnowledgeEntries({ status: "published" });
  const { data: scopeCategories = [] } = useKnowledgeCategories();

  const patch = (partial: Partial<ExtendedFormData>) =>
    setFormData((prev) => ({ ...prev, ...partial }));

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.system_prompt.trim()) return;

    const meta: AgentMetadata = {
      avatar: formData.avatar,
      is_public: formData.is_public,
      tools: formData.tools,
    };
    if (formData.tools.knowledge_base) {
      meta.knowledge_entry_ids =
        formData.knowledge_entry_ids.length > 0 ? formData.knowledge_entry_ids : [];
      meta.knowledge_category_ids =
        formData.knowledge_category_ids.length > 0 ? formData.knowledge_category_ids : [];
    } else {
      meta.knowledge_entry_ids = [];
      meta.knowledge_category_ids = [];
    }

    const payload: AgentFormData = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      category: formData.category,
      system_prompt: formData.system_prompt,
      is_enabled: formData.is_enabled,
      memory_enabled: formData.memory_enabled,
      provider_config: {
        provider: formData.provider,
        model: formData.model,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
      },
      metadata: meta,
      required_role: formData.required_role_input.trim() || null,
    };

    try {
      if (editingAgent) {
        await updateAgent.mutateAsync({ id: editingAgent.id, data: payload });
      } else {
        await createAgent.mutateAsync(payload);
      }
      setDialogOpen(false);
      resetForm();
    } catch {
      // Errors are handled by the mutation hooks
    }
  };

  const handleEdit = (agent: AIAgent) => {
    setEditingAgent(agent);
    const cfg = (agent.provider_config as AgentProviderConfig | null) ?? {};
    const meta = (agent.metadata as AgentMetadata | null) ?? {};
    const resolvedProvider = resolveLlmProviderFromConfig(agent.provider_config);
    setFormData({
      ...DEFAULT_FORM,
      name: agent.name,
      slug: agent.slug,
      description: agent.description || "",
      category: agent.category || "general",
      system_prompt: agent.system_prompt,
      is_enabled: agent.is_enabled,
      memory_enabled: agent.memory_enabled,
      provider: resolvedProvider,
      model: (cfg.model as string) || DEFAULT_MODEL_BY_PROVIDER[resolvedProvider],
      temperature: typeof cfg.temperature === "number" ? cfg.temperature : 0.7,
      max_tokens: typeof cfg.max_tokens === "number" ? cfg.max_tokens : 4096,
      avatar: meta.avatar || "🤖",
      is_public: meta.is_public ?? false,
      tools: meta.tools
        ? { ...Object.fromEntries(TOOL_IDS.map((id) => [id, false])), ...meta.tools }
        : Object.fromEntries(TOOL_IDS.map((id) => [id, false])),
      knowledge_entry_ids: Array.isArray(meta.knowledge_entry_ids) ? [...meta.knowledge_entry_ids] : [],
      knowledge_category_ids: Array.isArray(meta.knowledge_category_ids)
        ? [...meta.knowledge_category_ids]
        : [],
      required_role_input: agent.required_role?.trim() ?? "",
    });
    setCurrentStep(1);
    setDialogOpen(true);
  };

  // Open edit dialog when navigating with ?edit=<agentId> (e.g. from Agent Chat settings icon)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !agents?.length) return;
    const agent = agents.find((a) => a.id === editId);
    if (agent) {
      handleEdit(agent);
      setSearchParams({}, { replace: true });
    }
  }, [agents, searchParams]);

  // Open File Risk Agent panel when deep-linked from dashboard quick action.
  useEffect(() => {
    const shouldOpenFileRisk = searchParams.get("open") === "file-risk-agent";
    if (!shouldOpenFileRisk) return;
    setFileRiskPanelOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("open");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const openDeleteDialog = (agentId: string) => {
    setDeletingAgentId(agentId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingAgentId) return;
    try {
      await deleteAgent.mutateAsync(deletingAgentId);
      setDeleteDialogOpen(false);
      setDeletingAgentId(null);
    } catch {
      // Errors are handled by the mutation hooks
    }
  };

  const handleRun = async () => {
    if (!selectedAgent || !runInput.trim()) return;
    try {
      await runAgent.mutateAsync({ agentId: selectedAgent.id, input: runInput });
      setRunInput("");
      setRunDialogOpen(false);
    } catch {
      // Errors are handled by the mutation hooks
    }
  };

  const openRunDialog = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setRunDialogOpen(true);
  };

  const getAgentChatPath = (id: string) =>
    location.pathname.startsWith("/admin") ? `/admin/agents/${id}/chat` : `/ai/agents/${id}/chat`;

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setEditingAgent(null);
    setCurrentStep(1);
    setKnowledgeScopeFilter("");
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCategoryInfo = (category: string | null) =>
    CATEGORY_CONFIG[category || "general"] || CATEGORY_CONFIG.general;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      completed: { variant: "default", label: "Completed" },
      running: { variant: "secondary", label: "Running" },
      failed: { variant: "destructive", label: "Failed" },
      pending: { variant: "outline", label: "Pending" },
    };
    const { variant, label } = config[status] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getAgentModel = (agent: AIAgent): string => {
    if (agent.provider_config && typeof agent.provider_config === "object") {
      const cfg = agent.provider_config as Record<string, unknown>;
      if (typeof cfg.model === "string" && cfg.model.trim()) return cfg.model;
    }
    return getDefaultModelForProvider(resolveLlmProviderFromConfig(agent.provider_config));
  };

  const getAgentAvatar = (agent: AIAgent): string => {
    const meta = (agent.metadata as AgentMetadata | null) ?? {};
    return meta.avatar || "🤖";
  };

  const isProcessing = createAgent.isPending || updateAgent.isPending;

  // ── Step navigation ────────────────────────────────────────────────────────
  const canGoNext = () => {
    if (currentStep === 1) return formData.name.trim() !== "" && formData.system_prompt.trim() !== "";
    return true;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
            <p className="text-muted-foreground">
              Create and manage AI agents with dynamic provider routing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border bg-background p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Execution History
          </Button>

          {/* Create Agent dialog trigger */}
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </DialogTrigger>

            {/* ── Create / Edit Agent Dialog ── */}
            <DialogContent
              className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden p-0"
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
              {/* Dialog Header - fixed */}
              <div className="px-6 pt-6 pb-4 border-b shrink-0">
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <DialogTitle className="text-xl">
                      {editingAgent ? "Edit AI Agent" : "Create Agent"}
                    </DialogTitle>
                  </div>
                  <DialogDescription>
                    Configure your AI agent with custom instructions and capabilities
                  </DialogDescription>
                </DialogHeader>

                {/* Step tabs */}
                <div className="mt-4 flex rounded-lg bg-muted p-1 gap-1">
                  {[
                    { step: 1, label: "Basic Info" },
                    { step: 2, label: "Model & Params" },
                    { step: 3, label: "Tools" },
                  ].map(({ step, label }) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setCurrentStep(step)}
                      className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                        currentStep === step
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground cursor-pointer"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
                  style={{
                    height: '400px',
                    maxHeight: '55vh',
                    overflowY: 'scroll',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                <div className="space-y-5 pr-4">

                  {/* ─── Step 1: Basic Info ─── */}
                  {currentStep === 1 && (
                    <>
                      {!editingAgent && (
                        <div className="space-y-3">
                          <QuickStartWizard />
                          <AgentCategoryGuide />
                        </div>
                      )}

                      {/* Avatar picker */}
                      <div className="space-y-2">
                        <Label>Avatar</Label>
                        <div className="flex flex-wrap gap-2">
                          {AVATAR_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => patch({ avatar: emoji })}
                              className={`h-10 w-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors hover:border-primary ${
                                formData.avatar === emoji
                                  ? "border-primary bg-primary/10"
                                  : "border-transparent bg-muted"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          Agent Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => patch({ name: e.target.value })}
                          placeholder="e.g., Code Assistant, Research Helper"
                          required
                          disabled={isProcessing}
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label htmlFor="description">
                          Description <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => patch({ description: e.target.value })}
                          placeholder="Describe what this agent does..."
                          rows={3}
                          disabled={isProcessing}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {(formData.description || "").length}/500
                        </p>
                      </div>

                      {/* Category */}
                      <div className="space-y-2">
                        <Label htmlFor="category">
                          Category <span className="text-destructive">*</span>
                        </Label>
                        <SearchableSelect
                          value={formData.category}
                          onChange={(v) => patch({ category: v })}
                          options={[
                            { value: "general", label: "General" },
                            { value: "communication", label: "Communication" },
                            { value: "analysis", label: "Data Analysis" },
                            { value: "task_management", label: "Task Management" },
                          ]}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="required_role_input">Who can use this agent (optional)</Label>
                        <Input
                          id="required_role_input"
                          value={formData.required_role_input}
                          onChange={(e) => patch({ required_role_input: e.target.value })}
                          placeholder="e.g. loan_officer, branch_manager — leave empty for everyone"
                          disabled={isProcessing}
                        />
                        <p className="text-xs text-muted-foreground">
                          For custom agents only. System agents keep their built-in access rules. Use normalized role
                          names (comma-separated): <code className="text-xs">loan_officer</code>,{" "}
                          <code className="text-xs">branch_manager</code>, <code className="text-xs">admin</code>,{" "}
                          <code className="text-xs">moderator</code>, <code className="text-xs">user</code>.
                        </p>
                      </div>

                      {/* Make Public */}
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <Label className="cursor-pointer">Make Agent Public</Label>
                            <p className="text-sm text-muted-foreground">
                              Allow other users to discover and use this agent
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.is_public}
                          onCheckedChange={(v) => patch({ is_public: v })}
                          disabled={isProcessing}
                        />
                      </div>

                      {/* System Prompt */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="system_prompt">
                            System Prompt <span className="text-destructive">*</span>
                          </Label>
                          <SystemPromptGuide />
                        </div>
                        <Textarea
                          id="system_prompt"
                          value={formData.system_prompt}
                          onChange={(e) => patch({ system_prompt: e.target.value })}
                          placeholder="You are a helpful AI assistant."
                          rows={5}
                          required
                          disabled={isProcessing}
                        />
                      </div>
                    </>
                  )}

                  {/* ─── Step 2: Model & Params ─── */}
                  {currentStep === 2 && (
                    <>
                      {/* Provider */}
                      <div className="space-y-2">
                        <Label htmlFor="provider">
                          AI Provider <span className="text-destructive">*</span>
                        </Label>
                        <SearchableSelect
                          value={formData.provider}
                          onChange={(v) => {
                            const nextProvider = v as LlmProvider;
                            patch({
                              provider: nextProvider,
                              model: DEFAULT_MODEL_BY_PROVIDER[nextProvider],
                            });
                          }}
                          options={LLM_PROVIDER_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                        />
                      </div>

                      {/* AI Model */}
                      <div className="space-y-2">
                        <Label htmlFor="model">
                          AI Model <span className="text-destructive">*</span>
                        </Label>
                        <SearchableSelect
                          value={formData.model}
                          onChange={(v) => patch({ model: v })}
                          options={(AI_MODELS_BY_PROVIDER[formData.provider] ?? []).map((m) => ({ value: m.value, label: m.label }))}
                        />
                      </div>

                      {/* Temperature */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Temperature</Label>
                          <span className="text-sm font-medium tabular-nums">
                            {formData.temperature.toFixed(1)}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={1}
                          step={0.1}
                          value={[formData.temperature]}
                          onValueChange={([v]) => patch({ temperature: v })}
                          disabled={isProcessing}
                        />
                        <p className="text-xs text-muted-foreground">
                          Lower = more focused, higher = more creative.
                        </p>
                      </div>

                      {/* Max Tokens */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Tokens</Label>
                          <span className="text-sm font-medium tabular-nums">
                            {formData.max_tokens.toLocaleString()}
                          </span>
                        </div>
                        <Slider
                          min={256}
                          max={128000}
                          step={256}
                          value={[formData.max_tokens]}
                          onValueChange={([v]) => patch({ max_tokens: v })}
                          disabled={isProcessing}
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum tokens for response generation. Range: 256 to 128K.
                        </p>
                      </div>

                      <Separator />

                      {/* Memory toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <MemorySystemGuide />
                          <p className="text-sm text-muted-foreground">
                            Agent will remember previous interactions
                          </p>
                        </div>
                        <Switch
                          checked={formData.memory_enabled}
                          onCheckedChange={(v) => patch({ memory_enabled: v })}
                          disabled={isProcessing}
                        />
                      </div>

                      {/* Enable toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label>Enable Agent</Label>
                          <p className="text-sm text-muted-foreground">
                            Agent will be available for use immediately
                          </p>
                        </div>
                        <Switch
                          checked={formData.is_enabled}
                          onCheckedChange={(v) => patch({ is_enabled: v })}
                          disabled={isProcessing}
                        />
                      </div>
                    </>
                  )}

                  {/* ─── Step 3: Tools ─── */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      {!editingAgent && (
                        <div className="space-y-3">
                          <MultiAgentCollaborationInfo />
                          <HITLApprovalInfo />
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Select tools and capabilities to enable for this agent.
                      </p>

                      {[
                        {
                          id: "web_search",
                          icon: Search,
                          label: "Web Search",
                          description: "Allow the agent to search the web for real-time information",
                        },
                        {
                          id: "knowledge_base",
                          icon: Brain,
                          label: "Knowledge Base",
                          description:
                            "Search published knowledge articles and server-parsed document text (uploads)",
                        },
                        {
                          id: "data_analysis",
                          icon: BarChart2,
                          label: "Data Analysis",
                          description: "Enable chart generation and structured data analysis",
                        },
                        {
                          id: "integrations",
                          icon: Zap,
                          label: "Integrations",
                          description: "Connect to external apps like Zoom, Google Drive, etc.",
                        },
                        {
                          id: "code_execution",
                          icon: Wrench,
                          label: "Code Execution",
                          description: "Allow the agent to write and execute code snippets",
                        },
                      ].map(({ id, icon: Icon, label, description }) => (
                        <div key={id} className="space-y-2">
                          <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <Label className="cursor-pointer">{label}</Label>
                                <p className="text-sm text-muted-foreground">{description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={formData.tools[id] ?? false}
                              onCheckedChange={(v) =>
                                patch({ tools: { ...formData.tools, [id]: v } })
                              }
                              disabled={isProcessing}
                            />
                          </div>

                          {id === "knowledge_base" && formData.tools.knowledge_base && (
                            <div className="space-y-4 rounded-lg border border-dashed bg-muted/30 p-4">
                              <p className="text-sm text-muted-foreground">
                                Optional: restrict the knowledge search tool to specific articles and/or
                                categories. Leave none selected to search all published knowledge.
                              </p>
                              <div className="space-y-2">
                                <Label htmlFor="knowledge-scope-filter">Articles</Label>
                                <Input
                                  id="knowledge-scope-filter"
                                  placeholder="Filter by title…"
                                  value={knowledgeScopeFilter}
                                  onChange={(e) => setKnowledgeScopeFilter(e.target.value)}
                                  disabled={isProcessing}
                                />
                                <ScrollArea className="h-40 rounded-md border bg-background p-2">
                                  <div className="space-y-1 pr-3">
                              {scopeEntries
                                      .filter((e) =>
                                        knowledgeScopeFilter.trim()
                                          ? e.title
                                              .toLowerCase()
                                              .includes(knowledgeScopeFilter.trim().toLowerCase())
                                          : true,
                                      )
                                      .slice(0, 100)
                                      .map((e) => (
                                        <label
                                          key={e.id}
                                          className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                                        >
                                          <Checkbox
                                            checked={formData.knowledge_entry_ids.includes(e.id)}
                                            onCheckedChange={(c) => {
                                              const on = c === true;
                                              patch({
                                                knowledge_entry_ids: on
                                                  ? [...formData.knowledge_entry_ids, e.id]
                                                  : formData.knowledge_entry_ids.filter((x) => x !== e.id),
                                              });
                                            }}
                                            disabled={isProcessing}
                                          />
                                          <span className="truncate">{e.title}</span>
                                        </label>
                                      ))}
                                  </div>
                                </ScrollArea>
                              </div>
                              <div className="space-y-2">
                                <Label>Categories</Label>
                                <ScrollArea className="h-36 rounded-md border bg-background p-2">
                                  <div className="space-y-1 pr-3">
                                    {scopeCategories.map((c) => (
                                      <label
                                        key={c.id}
                                        className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                                      >
                                        <Checkbox
                                          checked={formData.knowledge_category_ids.includes(c.id)}
                                          onCheckedChange={(ck) => {
                                            const on = ck === true;
                                            patch({
                                              knowledge_category_ids: on
                                                ? [...formData.knowledge_category_ids, c.id]
                                                : formData.knowledge_category_ids.filter((x) => x !== c.id),
                                            });
                                          }}
                                          disabled={isProcessing}
                                        />
                                        <span>{c.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                {/* ── Footer navigation - sticky, always visible ── */}
                <div className="px-6 pb-6 pt-4 border-t flex items-center justify-between shrink-0 bg-background">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (currentStep === 1) {
                        setDialogOpen(false);
                        resetForm();
                      } else {
                        setCurrentStep((s) => s - 1);
                      }
                    }}
                    disabled={isProcessing}
                  >
                    {currentStep === 1 ? (
                      "Cancel"
                    ) : (
                      <>
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </>
                    )}
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    Step {currentStep} of {TOTAL_STEPS}
                  </span>

                  <div className="flex items-center gap-2">
                    {currentStep < TOTAL_STEPS && (
                      <Button
                        type="button"
                        onClick={() => setCurrentStep((s) => s + 1)}
                        disabled={!canGoNext() || isProcessing}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                    <Button type="submit" disabled={!canGoNext() || isProcessing}>
                      {isProcessing && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingAgent ? "Update" : "Create"} Agent
                    </Button>
                  </div>
                </div>
              </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {agents?.filter((a) => a.is_enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {agents?.filter((a) => !a.is_enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentRuns?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── System Agents ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">System Agents</h2>
          <p className="text-sm text-muted-foreground">Built-in rule-based agents — always available, no configuration required.</p>
        </div>

        {viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="flex flex-col border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xl">
                    🛡️
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base leading-tight">File Risk Agent</CardTitle>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        Risk Analysis
                      </span>
                      <span className="h-2 w-2 rounded-full bg-green-500" title="Active" />
                    </div>
                    <CardDescription className="mt-1 line-clamp-2 text-sm">
                      Rule-based pipeline risk analysis — lock expiry, stall detection, condition backlogs, and milestone delays.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                    ✦ rule-based
                  </span>
                  <Badge variant="outline" className="text-xs">Loans</Badge>
                </div>
                <div className="mt-auto">
                  <FileRiskAgentPanel
                    open={fileRiskPanelOpen}
                    onOpenChange={setFileRiskPanelOpen}
                    trigger={
                      <Button size="sm" className="w-full">
                        <ShieldAlert className="mr-2 h-3 w-3" />
                        Run Agent
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-lg">
                  🛡️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">File Risk Agent</span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                      Risk Analysis
                    </span>
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Rule-based pipeline risk analysis — lock expiry, stall detection, condition backlogs, and milestone delays.
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground shrink-0">
                  ✦ rule-based
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <FileRiskAgentPanel
                    open={fileRiskPanelOpen}
                    onOpenChange={setFileRiskPanelOpen}
                    trigger={
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs">
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        Run
                      </Button>
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Agent list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !agents || agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
            <Brain className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No AI agents yet</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* ── Grid view ── */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const catInfo = getCategoryInfo(agent.category);
            const model = getAgentModel(agent);
            const isToggling = toggleAgent.isPending;
            return (
              <Card
                key={agent.id}
                className={`flex flex-col transition-opacity ${!agent.is_enabled ? "opacity-60" : ""}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Avatar circle */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                        {getAgentAvatar(agent)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base leading-tight">
                            {agent.name}
                          </CardTitle>
                          {/* Category badge */}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catInfo.color}`}
                          >
                            {catInfo.label}
                          </span>
                        </div>
                        <CardDescription className="mt-1 line-clamp-2 text-sm">
                          {agent.description || "No description"}
                        </CardDescription>
                      </div>
                    </div>
                    {/* Help + enable toggle */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setGuideAgent(agent)}
                        title="How to use this agent"
                        aria-label="How to use this agent"
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {agent.is_enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Switch
                        checked={agent.is_enabled}
                        onCheckedChange={() =>
                          toggleAgent.mutate({ id: agent.id, enabled: !agent.is_enabled })
                        }
                        disabled={isToggling}
                        aria-label={agent.is_enabled ? "Disable agent" : "Enable agent"}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 flex-1">
                  {/* Model chip */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      ✦ {model}
                    </span>
                    {agent.memory_enabled && (
                      <Badge variant="outline" className="text-xs">Memory</Badge>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(getAgentChatPath(agent.id))}
                      disabled={!agent.is_enabled}
                    >
                      <MessageSquare className="mr-2 h-3 w-3" />
                      Chat
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2.5"
                      onClick={() => handleEdit(agent)}
                      title="Edit agent"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => openDeleteDialog(agent.id)}
                      title="Delete agent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ── List view ── */
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {agents.map((agent) => {
                const catInfo = getCategoryInfo(agent.category);
                const model = getAgentModel(agent);
                const isToggling = toggleAgent.isPending;
                return (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors ${
                      !agent.is_enabled ? "opacity-60" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                      {getAgentAvatar(agent)}
                    </div>

                    {/* Name + description */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{agent.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catInfo.color}`}
                        >
                          {catInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.description || "No description"}
                      </p>
                    </div>

                    {/* Model chip */}
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground shrink-0">
                      ✦ {model}
                    </span>

                    {/* Created date */}
                    <span className="hidden md:block text-xs text-muted-foreground shrink-0">
                      {new Date(agent.created_at).toLocaleDateString()}
                    </span>

                    {/* Enable toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {agent.is_enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Switch
                        checked={agent.is_enabled}
                        onCheckedChange={() =>
                          toggleAgent.mutate({ id: agent.id, enabled: !agent.is_enabled })
                        }
                        disabled={isToggling}
                        aria-label={agent.is_enabled ? "Disable agent" : "Enable agent"}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => setGuideAgent(agent)}
                        title="How to use this agent"
                        aria-label="How to use this agent"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => navigate(getAgentChatPath(agent.id))}
                        disabled={!agent.is_enabled}
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(agent)}
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(agent.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <AgentUserGuideDialog
        agent={guideAgent}
        open={!!guideAgent}
        onOpenChange={(o) => {
          if (!o) setGuideAgent(null);
        }}
      />

      {/* ── Run Agent Dialog ── */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Agent: {selectedAgent?.name}</DialogTitle>
            <DialogDescription>
              Provide input for the agent to process
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="run-input">Input</Label>
              <Textarea
                id="run-input"
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                placeholder="Enter your prompt or question..."
                rows={4}
                disabled={runAgent.isPending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRunDialogOpen(false);
                  setRunInput("");
                }}
                disabled={runAgent.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRun}
                disabled={runAgent.isPending || !runInput.trim()}
              >
                {runAgent.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Execute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Execution History Dialog ── */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              Recent agent executions and their results
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            {!recentRuns || recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No execution history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRuns.map((run) => (
                  <Card key={run.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {agents?.find((a) => a.id === run.agent_id)?.name || "Unknown Agent"}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status || "pending")}
                          {run.latency_ms && (
                            <Badge variant="outline" className="text-xs">
                              {run.latency_ms}ms
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Input:</Label>
                        <p className="text-sm mt-1">{run.input}</p>
                      </div>
                      {run.output && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Output:</Label>
                          <p className="text-sm mt-1">{run.output}</p>
                        </div>
                      )}
                      {run.error_message && (
                        <div>
                          <Label className="text-xs text-destructive">Error:</Label>
                          <p className="text-sm mt-1 text-destructive">{run.error_message}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone and will also delete all execution history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteAgent.isPending}>
              {deleteAgent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
