import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatScrollToBottom } from "@/hooks/useChatScrollToBottom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAdminSidebar } from "@/contexts/AdminSidebarContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { useAIAgent } from "@/hooks/useAIAgents";
import {
  useAgentConversations,
  useAgentMessages,
  useUpdateConversationTitle,
  useDeleteAgentConversation,
  type AgentConversation,
} from "@/hooks/useAgentConversations";
import { AgentMemoryPanel } from "@/components/agents/AgentMemoryPanel";
import { queryKeys } from "@/lib/cache";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isAgentAllowedForUser,
  canViewAgentMemoryPanel,
  canViewAllAgentMemories,
} from "@/lib/agentRoles";
import {
  type LlmProvider,
  getDefaultModelForProvider,
  resolveLlmProviderFromConfig,
} from "@/lib/aiAgentProviders";
import { useIntegrationSetting } from "@/hooks/useIntegrationSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Bot,
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  PanelLeftClose,
  PanelRight,
  Settings,
  ChevronDown,
  Brain,
  History,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type SidebarTab = "chats" | "memory";

const DEFAULT_WELCOME =
  "Send a message to start the conversation. I'll use the agent's instructions to help you.";

function formatThreadTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(d, "MMM d");
}

async function extractEdgeErrorMessage(err: unknown): Promise<string> {
  const fallback =
    err instanceof Error && err.message
      ? err.message
      : "Request failed.";

  const maybe = err as {
    context?: { json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  try {
    if (maybe?.context?.json) {
      const body = (await maybe.context.json()) as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    }
  } catch {
    // ignore parse errors
  }

  try {
    if (maybe?.context?.text) {
      const text = await maybe.context.text();
      if (text?.trim()) return text.trim();
    }
  } catch {
    // ignore parse errors
  }

  return fallback;
}

function shouldAutoGenerateTitle(currentTitle?: string | null): boolean {
  const normalized = currentTitle?.trim();
  return !normalized || normalized === "New chat";
}

interface AgentChatProps {
  fullScreen?: boolean;
}

export default function AgentChat({ fullScreen = false }: AgentChatProps) {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");
  // Optional loan context passed via navigate(path, { state: { loanContext: {...} } })
  const loanContext = (location.state as { loanContext?: Record<string, unknown> } | null)
    ?.loanContext ?? null;
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const canViewMemory = canViewAgentMemoryPanel(profile);
  const canViewAllMemories = canViewAllAgentMemories(profile);
  const appSidebar = useAppSidebar();
  const adminSidebar = useAdminSidebar();
  const queryClient = useQueryClient();
  const { data: agent, isLoading: agentLoading } = useAIAgent(agentId ?? "");
  const showMemoryTab = canViewMemory && !!agent?.memory_enabled;
  const activeProvider: LlmProvider = resolveLlmProviderFromConfig(agent?.provider_config);
  const { data: activeIntegration } = useIntegrationSetting(
    isAdmin && activeProvider !== "lovable" ? activeProvider : ""
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { data: conversations = [], refetch: refetchConversations } = useAgentConversations(
    agent?.id,
    user?.id
  );
  const { data: messageRows = [], refetch: refetchMessages } = useAgentMessages(conversationId);
  const updateTitle = useUpdateConversationTitle(agent?.id ?? "", user?.id ?? "");
  const deleteConversation = useDeleteAgentConversation(agent?.id ?? "", user?.id ?? "");

  // Collapse the correct sidebar by default: admin sidebar when in admin panel, app sidebar when under /ai
  useEffect(() => {
    if (fullScreen) return;
    if (isAdminPath && adminSidebar?.setCollapsed) {
      adminSidebar.setCollapsed(true);
    } else if (!isAdminPath && appSidebar?.setCollapsed) {
      appSidebar.setCollapsed(true);
    }
  }, [fullScreen, isAdminPath, adminSidebar?.setCollapsed, appSidebar?.setCollapsed]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats");
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [hasPickedInitialConversation, setHasPickedInitialConversation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("agent-chat-sidebar-open");
      return stored !== "false";
    } catch {
      return true;
    }
  });

  const {
    scrollRootRef: messagesScrollRootRef,
    bottomRef,
    isAtBottom,
    scrollToBottom,
    scrollToBottomAfterRender,
  } = useChatScrollToBottom(
    messages.length,
    isLoading
  );

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("agent-chat-sidebar-open", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Lovable uses LOVABLE_API_KEY on the edge — no integration_settings row required.
  const isProviderReady =
    !isAdmin ||
    activeProvider === "lovable" ||
    (!!activeIntegration?.api_key && activeIntegration.is_active !== false);
  const providerLabel =
    activeProvider === "lovable"
      ? "Lovable AI"
      : activeProvider === "google"
        ? "Google AI"
        : activeProvider === "anthropic"
          ? "Anthropic"
          : activeProvider === "perplexity"
            ? "Perplexity"
            : "OpenAI";

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId]
  );

  useEffect(() => {
    if (isLoading) return;
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const restored: Message[] = messageRows.map((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
      timestamp: new Date(m.created_at),
    }));
    setMessages(restored);
  }, [messageRows, conversationId, isLoading]);

  useEffect(() => {
    if (hasPickedInitialConversation || !conversations.length) return;
    const latest = conversations[0];
    if (latest?.id) {
      setConversationId(latest.id);
      setHasPickedInitialConversation(true);
    }
  }, [conversations, hasPickedInitialConversation]);

  useEffect(() => {
    setHasPickedInitialConversation(false);
    setConversationId(null);
    setMessages([]);
  }, [agent?.id, user?.id]);

  useEffect(() => {
    if (!showMemoryTab && sidebarTab === "memory") {
      setSidebarTab("chats");
    }
  }, [showMemoryTab, sidebarTab]);

  const generateAndUpdateTitle = useCallback(
    async (convId: string, currentTitle?: string | null) => {
      if (!shouldAutoGenerateTitle(currentTitle)) return;
      const firstUser = messageRows.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      const firstAssistant =
        messageRows.find((m) => m.role === "assistant")?.content?.slice(0, 200) ?? "";
      if (!firstUser || !firstAssistant) return;
      try {
        const { data } = await supabase.functions.invoke("ai-chat-assistant", {
          body: {
            messages: [
              {
                role: "system",
                content:
                  "Generate a short conversation title in 3-6 words. Reply with only the title, no quotes or punctuation.",
              },
              {
                role: "user",
                content: `User: ${firstUser}\nAssistant: ${firstAssistant}`,
              },
            ],
            model: "gpt-4o-mini",
            temperature: 0.3,
          },
        });
        const raw = data?.choices?.[0]?.message?.content ?? data?.response ?? "";
        const title = String(raw).trim().slice(0, 80) || "New chat";
        await supabase.from("agent_conversations").update({ title }).eq("id", convId);
        refetchConversations();
      } catch {
        // Non-blocking
      }
    },
    [messageRows, refetchConversations]
  );

  const loadConversation = useCallback((conv: AgentConversation) => {
    setConversationId(conv.id);
    setSidebarTab("chats");
  }, []);

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setSidebarTab("chats");
  };

  const invalidateChatQueries = useCallback(
    (convId: string | null) => {
      if (agent?.id && user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ai.conversations(agent.id, user.id),
        });
        queryClient.invalidateQueries({
          queryKey: ["ai", "memories", agent.id],
        });
      }
      if (convId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ai.messages(convId),
        });
      }
    },
    [agent?.id, user?.id, queryClient]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user || !agent) return;
    if (!isProviderReady) {
      toast.error(
        `${providerLabel} integration is not configured. Add a valid API key in Admin → Integrations.`
      );
      return;
    }

    const userContent = input.trim();
    const userMsg: Message = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottomAfterRender();
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const body: Record<string, unknown> = {
        agent_slug: agent.slug,
        agent_id: agent.id,
        input: userContent,
        conversation_history: conversationHistory,
        conversation_id: conversationId,
      };
      if (loanContext) body.context = loanContext;

      const { data, error } = await supabase.functions.invoke("run-ai-agent", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const responseConversationId =
        typeof data?.conversation_id === "string" ? (data.conversation_id as string) : null;
      const resolvedConvId = responseConversationId ?? conversationId;
      if (responseConversationId && !conversationId) {
        setConversationId(responseConversationId);
        setHasPickedInitialConversation(true);
      }

      invalidateChatQueries(resolvedConvId);
      await refetchMessages();
      await refetchConversations();

      if (resolvedConvId) {
        const conv = conversations.find((c) => c.id === resolvedConvId);
        generateAndUpdateTitle(resolvedConvId, conv?.title);
      }
    } catch (err: unknown) {
      const message = await extractEdgeErrorMessage(err);
      console.error("Agent chat error:", err);
      toast.error(message || "Failed to get response.");
      const errMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `Error: ${message || "Request failed."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (agentLoading || !agentId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const agentsCatalogHref = isAdminPath ? "/admin/agents" : "/agents";

  if (!agent) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Agent not found.</p>
        <Button variant="outline" asChild>
          <Link to={agentsCatalogHref}>Back to Agents</Link>
        </Button>
      </div>
    );
  }

  if (!isAgentAllowedForUser(agent.slug, profile, agent.required_role ?? null)) {
    const back = agentsCatalogHref;
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">You do not have access to this agent.</p>
        <Button variant="outline" asChild>
          <Link to={back}>Back to Agents</Link>
        </Button>
      </div>
    );
  }

  const backHref = agentsCatalogHref;
  const showAgentConfigGear = profile?.role !== "user";
  const agentConfigHref =
    profile?.role === "admin" || profile?.role === "moderator"
      ? `/admin/agents?edit=${agent.id}`
      : `/agents/${agent.slug}`;

  const displayModel =
    (() => {
      const cfg = agent.provider_config as { model?: string } | null;
      if (typeof cfg?.model === "string" && cfg.model.trim()) return cfg.model;
      return getDefaultModelForProvider(activeProvider);
    })();

  return (
    <div
      className={
        fullScreen
          ? "flex h-[calc(100vh-4rem)] w-full rounded-none border-0 bg-card overflow-hidden"
          : "flex h-[calc(100vh-4rem)] w-full -m-6 -mr-0 lg:-m-8 lg:-mr-0 rounded-none border-0 bg-card overflow-hidden"
      }
    >
      {/* Left sidebar — wider so description and chats have room */}
      <aside
        className={`flex flex-col shrink-0 border-r bg-muted/20 transition-[width] duration-200 ease-in-out overflow-hidden ${
          sidebarOpen ? "w-[380px]" : "w-14"
        }`}
      >
        {sidebarOpen ? (
          <>
            {/* Compact header: back + collapse */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b min-h-12">
              <Button variant="ghost" size="sm" className="shrink-0 -ml-1" asChild>
                <Link to={backHref}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSidebar} aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {/* Agent + New chat in compact block */}
            <div className="px-3 py-2.5 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    {displayModel}
                    {showMemoryTab && (
                      <span className="inline-flex items-center rounded border px-1 py-0 text-[10px] font-medium">
                        Memory
                      </span>
                    )}
                  </p>
                </div>
                {showAgentConfigGear ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    aria-label="Edit agent config"
                    asChild
                  >
                    <Link to={agentConfigHref}>
                      <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                  </Button>
                ) : null}
              </div>
              {agent.description && (
                <div className="mt-2 max-h-28 overflow-y-auto">
                  <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap" title={agent.description}>
                    {agent.description}
                  </p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2 h-8 text-xs" onClick={handleNewChat}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                New chat
              </Button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 px-1">
              <Tabs
                value={showMemoryTab ? sidebarTab : "chats"}
                onValueChange={(v) => {
                  if (showMemoryTab) setSidebarTab(v as SidebarTab);
                }}
                className="flex flex-col flex-1 min-h-0"
              >
                <TabsList
                  className={`mx-2 mt-2 grid w-auto ${showMemoryTab ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  <TabsTrigger value="chats" className="text-xs gap-1">
                    <History className="h-3.5 w-3.5" />
                    Chats
                  </TabsTrigger>
                  {showMemoryTab && (
                    <TabsTrigger value="memory" className="text-xs gap-1">
                      <Brain className="h-3.5 w-3.5" />
                      Memory
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="chats" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
                  <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Your chats
                  </p>
                  <ScrollArea className="flex-1 min-h-[180px]">
                    <div className="pr-2 pb-3 space-y-0.5 px-1">
                      {conversations.length === 0 && (
                        <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                          No conversations yet. Send a message to start.
                        </p>
                      )}
                      {conversations.map((t) => (
                        <div
                          key={t.id}
                          className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left cursor-pointer transition-colors ${
                            conversationId === t.id
                              ? "bg-primary/10 border-l-2 border-l-primary"
                              : "hover:bg-muted/60 border-l-2 border-l-transparent"
                          }`}
                          onClick={() => loadConversation(t)}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 mt-0.5">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium text-sm leading-snug line-clamp-2 break-words"
                              title={t.title?.trim() || "New chat"}
                            >
                              {t.title?.trim() || "New chat"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.last_message_at
                                ? formatThreadTime(t.last_message_at)
                                : formatThreadTime(t.created_at)}
                              {t.message_count > 0 ? ` · ${t.message_count} msgs` : ""}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100 rounded-full mt-0.5"
                                aria-label="Rename or delete chat"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="w-48"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setRenameConversationId(t.id);
                                  setRenameTitle(t.title?.trim() || "New chat");
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setDeleteConversationId(t.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                {showMemoryTab && (
                  <TabsContent
                    value="memory"
                    className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden"
                  >
                    {user?.id && agent?.id ? (
                      <AgentMemoryPanel
                        agentId={agent.id}
                        userId={user.id}
                        scope={canViewAllMemories ? "all" : "own"}
                      />
                    ) : null}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center pt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleSidebar}
              aria-label="Expand sidebar to see chats"
            >
              <PanelRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </aside>

      {/* Main chat area — content-first, full height */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Slim top bar: left | center title | right */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 h-12">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -ml-1" onClick={toggleSidebar} aria-label="Expand sidebar">
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-medium text-sm truncate flex-1 min-w-0 text-center mx-2">
            {activeConversation?.title?.trim() || "New chat"}
          </h1>
          <span className="text-xs text-muted-foreground shrink-0">{displayModel}</span>
        </div>

        {!isProviderReady && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>
              {providerLabel} integration is not configured. Add and enable an API key in Admin → Integrations to chat.
            </p>
          </div>
        )}

        {loanContext && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
            <Bot className="h-3.5 w-3.5 shrink-0" />
            <span>
              Loan context active
              {typeof loanContext.loan_number === "string" ? ` — ${loanContext.loan_number}` : ""}
              {typeof loanContext.borrower_name === "string" ? ` · ${loanContext.borrower_name}` : ""}
            </span>
          </div>
        )}

        {/* Messages — fills space; content pins to bottom */}
        <div className="flex-1 min-h-0 flex flex-col w-full min-w-0">
          <ScrollArea
            ref={messagesScrollRootRef}
            className="flex-1 min-h-0 w-full min-w-0"
          >
            <div className="min-h-full flex flex-col justify-end py-4 px-4">
              <div className="max-w-3xl mx-auto w-full space-y-5 pt-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-medium text-base">Chat with {agent.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                      {agent.description || DEFAULT_WELCOME}
                    </p>
                    {agent.system_prompt && (
                      <p className="text-xs text-muted-foreground mt-3 italic max-w-lg mx-auto">
                        {agent.system_prompt.slice(0, 120)}…
                      </p>
                    )}
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc ml-4 mb-2" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal ml-4 mb-2" {...props} />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      <p className="text-xs opacity-70 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>{getInitials(profile?.full_name || "U")}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-2xl bg-muted px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </ScrollArea>

          {!isAtBottom && (messages.length > 0 || isLoading) && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow-md text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity duration-200"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* Input — wide, centered, with disclaimer */}
          <div className="shrink-0 border-t bg-background/95 backdrop-blur py-4 px-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isLoading || !isProviderReady}
                className="min-h-[48px] flex-1 text-base"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim() || !isProviderReady}
                size="icon"
                className="h-12 w-12 shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <Dialog
        open={!!renameConversationId}
        onOpenChange={(open) => !open && setRenameConversationId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Conversation title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameConversationId(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameConversationId || !renameTitle.trim() || updateTitle.isPending}
              onClick={() => {
                if (!renameConversationId || !renameTitle.trim()) return;
                updateTitle.mutate(
                  { conversationId: renameConversationId, title: renameTitle },
                  { onSettled: () => setRenameConversationId(null) }
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteConversationId}
        onOpenChange={(open) => !open && setDeleteConversationId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All messages and linked memories from this thread will be
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConversationId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConversation.isPending}
              onClick={() => {
                if (!deleteConversationId) return;
                deleteConversation.mutate(deleteConversationId, {
                  onSuccess: () => {
                    if (conversationId === deleteConversationId) {
                      setMessages([]);
                      setConversationId(null);
                    }
                    setDeleteConversationId(null);
                  },
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
