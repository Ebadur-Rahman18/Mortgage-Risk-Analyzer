// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { useState, useEffect, useCallback } from "react";
import { useChatScrollToBottom } from "@/hooks/useChatScrollToBottom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
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
  ChevronDown,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatThread {
  id: string;
  title: string | null;
  last_message_at: string;
  metadata?: {
    conversation_id?: string | null;
    provider_used?: string | null;
    model_used?: string | null;
  } | null;
}

const DEFAULT_WELCOME =
  "Chat with AI to get insights and assistance.";
const AI_CHAT_THREAD_SLUG = "default-assistant-chat";

interface RuntimeAssistantAgent {
  id: string;
  slug: string;
  name?: string | null;
  provider_config: unknown;
}

type LlmProvider = "openai" | "google" | "anthropic" | "perplexity";

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

function shouldAutoGenerateTitle(currentTitle?: string | null): boolean {
  const normalized = currentTitle?.trim();
  return !normalized || normalized === "New chat";
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

export default function AIChat() {
  const { user, profile } = useAuth();
  const sidebar = useAppSidebar();
  const isAdmin = profile?.role === "admin";

  // Keep app sidebar expanded by default on AI Chat.
  useEffect(() => {
    sidebar?.setCollapsed?.(false);
  }, [sidebar?.setCollapsed]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [runtimeAgent, setRuntimeAgent] = useState<RuntimeAssistantAgent | null>(null);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const providerFromConfig =
    runtimeAgent?.provider_config &&
    typeof runtimeAgent.provider_config === "object" &&
    "provider" in runtimeAgent.provider_config &&
    typeof (runtimeAgent.provider_config as { provider?: unknown }).provider === "string"
      ? (runtimeAgent.provider_config as { provider: string }).provider.toLowerCase()
      : "";
  const hasExplicitProvider =
    providerFromConfig === "openai" ||
    providerFromConfig === "google" ||
    providerFromConfig === "anthropic" ||
    providerFromConfig === "perplexity";
  const activeProvider: LlmProvider = hasExplicitProvider
    ? (providerFromConfig as LlmProvider)
    : "openai";
  const { data: activeIntegration } = useIntegrationSetting(isAdmin ? activeProvider : "");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("ai-chat-sidebar-open");
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
        localStorage.setItem("ai-chat-sidebar-open", String(next));
      } catch {}
      return next;
    });
  }, []);

  const currentAgentSlug = AI_CHAT_THREAD_SLUG;

  // Non-admin users may not be allowed to read integration settings directly.
  // They should still be able to use chat if they have route/permission access.
  const isProviderReady =
    !isAdmin ||
    !hasExplicitProvider ||
    (!!activeIntegration?.api_key && activeIntegration.is_active !== false);
  const providerLabel =
    activeProvider === "google"
      ? "Google AI"
      : activeProvider === "anthropic"
        ? "Anthropic"
        : activeProvider === "perplexity"
          ? "Perplexity"
        : "OpenAI";

  const displayModel = modelUsed ?? "";
  const effectiveProvider = (providerUsed ?? "").toLowerCase();
  const effectiveProviderLabel =
    effectiveProvider === "google"
      ? "Google AI"
      : effectiveProvider === "anthropic"
        ? "Anthropic"
        : effectiveProvider === "perplexity"
          ? "Perplexity"
          : effectiveProvider === "openai"
            ? "OpenAI"
            : "";
  const displayName = "Default Assistant";
  const displayDescription = effectiveProviderLabel
    ? `${DEFAULT_WELCOME} Active provider: ${effectiveProviderLabel}.`
    : DEFAULT_WELCOME;

  useEffect(() => {
    if (!user?.id) {
      setRuntimeAgent(null);
      return;
    }

    let cancelled = false;
    async function resolveRuntimeAgent() {
      // /ai stays a "normal chat" in UI, but uses one hidden memory-enabled agent for memory pipeline.
      const { data: memoryCandidates, error: memoryErr } = await supabase
        .from("ai_agents")
        .select("id, slug, name, provider_config")
        .eq("is_enabled", true)
        .eq("memory_enabled", true)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      let runtimeCandidates = (!memoryErr && memoryCandidates && memoryCandidates.length > 0)
        ? (memoryCandidates as RuntimeAssistantAgent[])
        : [];

      // Fallback: avoid hard failures in UI if memory-enabled agents are temporarily unavailable.
      if (runtimeCandidates.length === 0) {
        const { data: enabledCandidates, error: enabledErr } = await supabase
          .from("ai_agents")
          .select("id, slug, name, provider_config")
          .eq("is_enabled", true)
          .order("created_at", { ascending: true });
        if (!enabledErr && enabledCandidates && enabledCandidates.length > 0) {
          runtimeCandidates = enabledCandidates as RuntimeAssistantAgent[];
        }
      }

      if (runtimeCandidates.length === 0) {
        setRuntimeAgent(null);
        return;
      }

      const preferred = runtimeCandidates.find((a) => a.slug === "customer-support-assistant") ??
        runtimeCandidates.find((a) => a.slug === "ai-chat-assistant") ??
        runtimeCandidates.find((a) => a.name?.toLowerCase() === "default assistant") ??
        runtimeCandidates[0];

      setRuntimeAgent(preferred);
    }

    resolveRuntimeAgent();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const fetchThreads = useCallback(async () => {
    if (!user?.id) {
      setThreads([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("ai_chat_threads")
        .select("id, title, last_message_at, metadata")
        .eq("user_id", user.id)
        .eq("agent_slug", currentAgentSlug)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      setThreads((data ?? []) as ChatThread[]);
    } catch (e) {
      console.error("Fetch threads:", e);
    }
  }, [user?.id, currentAgentSlug]);

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      setThreadId(null);
      setConversationId(null);
      setProviderUsed(null);
      setModelUsed(null);
      return;
    }
    fetchThreads();
    // Always start /ai in a fresh chat state; user can open history manually.
    setMessages([]);
    setThreadId(null);
    setConversationId(null);
  }, [user?.id, fetchThreads]);

  const generateAndUpdateTitle = useCallback(
    async (tid: string, allMessages: Message[], currentTitle?: string | null) => {
      if (!shouldAutoGenerateTitle(currentTitle)) return;
      const firstUser = allMessages.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      const firstAssistant = allMessages.find((m) => m.role === "assistant")?.content?.slice(0, 200) ?? "";
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
        await supabase.from("ai_chat_threads").update({ title }).eq("id", tid);
        fetchThreads();
      } catch {
        // Non-blocking
      }
    },
    [fetchThreads]
  );

  const persistThread = useCallback(
    async (
      allMessages: Message[],
      title?: string | null,
      conversationIdOverride?: string | null,
      providerUsedOverride?: string | null,
      modelUsedOverride?: string | null
    ) => {
      if (!user) return;
      const persistedConversationId = conversationIdOverride ?? conversationId;
      const persistedProviderUsed = providerUsedOverride ?? providerUsed;
      const persistedModelUsed = modelUsedOverride ?? modelUsed;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        agent_slug: currentAgentSlug,
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
        last_message_at: new Date().toISOString(),
        metadata: {
          conversation_id: persistedConversationId,
          provider_used: persistedProviderUsed,
          model_used: persistedModelUsed,
        },
      };
      if (title !== undefined) payload.title = title;
      else if (!threadId) payload.title = "New chat";
      try {
        let resolvedId: string | null = null;
        if (threadId) {
          await supabase.from("ai_chat_threads").update(payload).eq("id", threadId);
          resolvedId = threadId;
          fetchThreads();
        } else {
          const { data } = await supabase
            .from("ai_chat_threads")
            .insert(payload)
            .select("id")
            .single();
          if (data?.id) {
            setThreadId(data.id);
            fetchThreads();
            resolvedId = data.id;
          }
        }
        if (resolvedId && allMessages.length >= 2 && title === undefined) {
          const currentTitle =
            resolvedId === threadId
              ? threads.find((t) => t.id === resolvedId)?.title
              : "New chat";
          generateAndUpdateTitle(resolvedId, allMessages, currentTitle);
        }
      } catch (e) {
        console.error("Persist thread:", e);
      }
    },
    [user, threadId, conversationId, providerUsed, modelUsed, currentAgentSlug, fetchThreads, generateAndUpdateTitle, threads]
  );

  const loadThread = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_chat_threads")
        .select("id, messages, metadata")
        .eq("id", id)
        .single();
      if (error || !data) throw error ?? new Error("Thread not found");
      const restored: Message[] = Array.isArray(data.messages)
        ? data.messages.map((m: { role?: string; content?: string; timestamp?: string }, i: number) => ({
            id: String(i + 1),
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content ?? ""),
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }))
        : [];
      setMessages(restored);
      setThreadId(data.id);
      const loadedConversationId =
        data.metadata &&
        typeof data.metadata === "object" &&
        "conversation_id" in data.metadata
          ? (data.metadata as { conversation_id?: unknown }).conversation_id
          : null;
      setConversationId(typeof loadedConversationId === "string" ? loadedConversationId : null);
      const loadedProviderUsed =
        data.metadata &&
        typeof data.metadata === "object" &&
        "provider_used" in data.metadata
          ? (data.metadata as { provider_used?: unknown }).provider_used
          : null;
      const loadedModelUsed =
        data.metadata &&
        typeof data.metadata === "object" &&
        "model_used" in data.metadata
          ? (data.metadata as { model_used?: unknown }).model_used
          : null;
      setProviderUsed(typeof loadedProviderUsed === "string" ? loadedProviderUsed : null);
      setModelUsed(typeof loadedModelUsed === "string" ? loadedModelUsed : null);
    } catch (e) {
      console.error("Load thread:", e);
      toast.error("Failed to load conversation");
    }
  }, []);

  const handleNewChat = () => {
    setMessages([]);
    setThreadId(null);
    setConversationId(null);
    setProviderUsed(null);
    setModelUsed(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;
    if (!isProviderReady) {
      toast.error(
        `${providerLabel} integration is not configured. Add a valid API key in Admin → Integrations.`
      );
      return;
    }

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottomAfterRender();
    setInput("");
    setIsLoading(true);

    try {
      if (!runtimeAgent) {
        throw new Error("Default Assistant memory agent is not configured.");
      }

      const conversationHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          agent_slug: runtimeAgent.slug,
          agent_id: runtimeAgent.id,
          input: userMsg.content,
          conversation_history: conversationHistory,
          conversation_id: conversationId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const responseConversationId =
        typeof data?.conversation_id === "string" ? data.conversation_id : conversationId;
      const responseProviderUsed =
        typeof data?.provider_used === "string" ? data.provider_used : null;
      const responseModelUsed =
        typeof data?.model_used === "string" ? data.model_used : null;
      if (responseConversationId && responseConversationId !== conversationId) {
        setConversationId(responseConversationId);
      }
      if (responseProviderUsed) setProviderUsed(responseProviderUsed);
      if (responseModelUsed) setModelUsed(responseModelUsed);

      const assistantContent = data?.output ?? "I couldn't generate a response.";
      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        persistThread(
          next,
          undefined,
          responseConversationId,
          responseProviderUsed ?? providerUsed,
          responseModelUsed ?? modelUsed
        );
        return next;
      });
    } catch (err: unknown) {
      const message = await extractEdgeErrorMessage(err);
      console.error("AI chat error:", err);
      toast.error(message);
      const errMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `Error: ${message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full -m-6 -mr-0 lg:-m-8 lg:-mr-0 rounded-none border-0 bg-card overflow-hidden">
      {/* Left sidebar — same structure as AgentChat */}
      <aside
        className={`flex flex-col shrink-0 border-r bg-muted/20 transition-[width] duration-200 ease-in-out overflow-hidden ${
          sidebarOpen ? "w-[380px]" : "w-14"
        }`}
      >
        {sidebarOpen ? (
          <>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b min-h-12">
              <Button variant="ghost" size="sm" className="shrink-0 -ml-1" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSidebar} aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {/* Assistant + New chat */}
            <div className="px-3 py-2.5 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">Default Assistant</p>
                  {displayModel && (
                    <p className="text-xs text-muted-foreground">{displayModel}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 max-h-28 overflow-y-auto">
                <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap" title={displayDescription}>
                  {displayDescription}
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2 h-8 text-xs" onClick={handleNewChat}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                New chat
              </Button>
            </div>
            {/* Your chats */}
            <div className="flex-1 flex flex-col min-h-0">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Your chats</p>
              <ScrollArea className="flex-1 min-h-[180px]">
                <div className="pr-2 pb-3 space-y-0.5 px-1">
                  {threads.map((t) => (
                    <div
                      key={t.id}
                      className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left cursor-pointer transition-colors ${
                        threadId === t.id
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-muted/60 border-l-2 border-l-transparent"
                      }`}
                      onClick={() => loadThread(t.id)}
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
                          {formatThreadTime(t.last_message_at)}
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
                        <DropdownMenuContent align="start" className="w-48" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setRenameThreadId(t.id);
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
                              setDeleteThreadId(t.id);
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
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center pt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
            >
              <PanelRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        <div className="flex items-center justify-between pl-4 pr-2 py-2.5 border-b shrink-0 h-12">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -ml-1" onClick={toggleSidebar} aria-label="Expand sidebar">
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-medium text-sm truncate flex-1 min-w-0 text-center mx-2">
            {threadId ? (threads.find((t) => t.id === threadId)?.title?.trim() || "New chat") : "New chat"}
          </h1>
          {displayModel && (
            <span className="text-xs text-muted-foreground shrink-0">{displayModel}</span>
          )}
        </div>

        {!isProviderReady && (
          <div className="ml-4 mr-1 mt-4 flex items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>
              {providerLabel} integration is not configured. Add and enable an API key in Admin → Integrations to chat.
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col w-full min-w-0">
          <ScrollArea
            ref={messagesScrollRootRef}
            className="flex-1 min-h-0 w-full min-w-0"
          >
            <div className="min-h-full flex flex-col justify-end py-4 pl-4 pr-1">
              <div className="w-full space-y-5 pt-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-medium text-base">Chat with {displayName}</h3>
                    <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                      {displayDescription}
                    </p>
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

          <div className="shrink-0 border-t bg-background/95 backdrop-blur py-4 pl-4 pr-1">
            <form onSubmit={handleSubmit} className="w-full flex gap-2">
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

      {/* Rename thread dialog */}
      <Dialog open={!!renameThreadId} onOpenChange={(open) => !open && setRenameThreadId(null)}>
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
            <Button variant="outline" onClick={() => setRenameThreadId(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!renameThreadId || !renameTitle.trim()) return;
                try {
                  await supabase
                    .from("ai_chat_threads")
                    .update({ title: renameTitle.trim() })
                    .eq("id", renameThreadId);
                  fetchThreads();
                  setRenameThreadId(null);
                  toast.success("Conversation renamed");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to rename");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete thread confirmation */}
      <AlertDialog open={!!deleteThreadId} onOpenChange={(open) => !open && setDeleteThreadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All messages in this conversation will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteThreadId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteThreadId) return;
                try {
                  const { error } = await supabase
                    .from("ai_chat_threads")
                    .delete()
                    .eq("id", deleteThreadId);
                  if (error) throw error;
                  if (threadId === deleteThreadId) {
                    setMessages([]);
                    setThreadId(null);
                  }
                  fetchThreads();
                  setDeleteThreadId(null);
                  toast.success("Conversation deleted");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to delete");
                }
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
