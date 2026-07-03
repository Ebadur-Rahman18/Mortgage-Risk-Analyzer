import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLoan } from "@/hooks/useLoans";
import { useLoanConditions } from "@/hooks/useLoanConditions";
import { useLoanMilestones } from "@/hooks/useLoanMilestones";
import { useLoanRiskScore } from "@/hooks/useLoanRiskScore";
import { toast } from "sonner";
import { isAgentAllowedForUser } from "@/lib/agentRoles";

const AGENT_SLUG = "loan-coaching-agent";

export interface CoachingMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface CoachingThread {
  id: string;
  title: string | null;
  last_message_at: string;
}

interface LoanContextPayload {
  loan: Record<string, unknown>;
  conditions?: Record<string, unknown>[];
  milestones?: Record<string, unknown>[];
  risk_score?: Record<string, unknown> | null;
}

export function useLoanCoachingAgent(loanId: string | undefined) {
  const { user, profile } = useAuth();

  const DEFAULT_THREAD_TITLE_PREFIX = "Coaching: Loan #";
  const isRoleAllowed = isAgentAllowedForUser(AGENT_SLUG, profile);
  const { data: loan } = useLoan(loanId);
  const { data: conditions } = useLoanConditions(loanId);
  const { data: milestones } = useLoanMilestones(loanId);
  const { data: riskScore } = useLoanRiskScore(loanId);

  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<CoachingThread[]>([]);
  const [proactiveSuggestion, setProactiveSuggestion] = useState<string | null>(null);
  const [isLoadingProactive, setIsLoadingProactive] = useState(false);
  const threadLoadedRef = useRef(false);
  const titleGeneratedRef = useRef<Record<string, boolean>>({});

  const borrower = (loan as any)?.borrowers as
    | { first_name?: string; last_name?: string }
    | undefined;
  const borrowerName = borrower
    ? [borrower.first_name, borrower.last_name].filter(Boolean).join(" ")
    : undefined;

  const loanContext = useMemo((): LoanContextPayload | null => {
    if (!loan) return null;
    return {
      loan: {
        loan_number: loan.loan_number,
        status: loan.status,
        loan_amount: loan.loan_amount,
        appraised_value: loan.appraised_value,
        ltv: loan.ltv,
        credit_score: loan.credit_score,
        dti: loan.dti,
        purpose: loan.purpose,
        occupancy_type: loan.occupancy_type,
        property_address: loan.property_address,
        property_city: loan.property_city,
        property_state: loan.property_state,
        property_postal_code: loan.property_postal_code,
        lock_date: loan.lock_date,
        lock_expiration_date: loan.lock_expiration_date,
        borrower_name: borrowerName,
        data_source: loan.data_source,
      },
      conditions: conditions?.map((c) => ({
        condition_type: c.condition_type,
        category: c.category,
        description: c.description,
        status: c.status,
        due_date: c.due_date,
      })),
      milestones: milestones?.map((m) => ({
        name: m.name,
        milestone_type: m.milestone_type,
        due_date: m.due_date,
        completed_at: m.completed_at,
      })),
      risk_score: riskScore
        ? {
            overall_risk_score: riskScore.overall_risk_score,
            risk_level: riskScore.risk_level,
            stall_risk: riskScore.stall_risk,
            lock_expiry_risk: riskScore.lock_expiry_risk,
            condition_risk: riskScore.condition_risk,
          }
        : null,
    };
  }, [loan, conditions, milestones, riskScore, borrowerName]);

  // Compute whether the loan needs attention (drives the pulsing icon)
  const needsAttention = useMemo(() => {
    if (!isRoleAllowed) return false;
    if (!loan) return false;

    const hasPendingConditions = conditions?.some(
      (c) => c.status === "pending" || c.status === "requested",
    );

    const hasHighRisk =
      riskScore != null && riskScore.overall_risk_score >= 50;

    const lockExpiringSoon = (() => {
      if (!loan.lock_expiration_date) return false;
      const expiry = new Date(loan.lock_expiration_date);
      const now = new Date();
      const daysUntilExpiry =
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    })();

    const hasOverdueMilestones = milestones?.some((m) => {
      if (m.completed_at) return false;
      if (!m.due_date) return false;
      return new Date(m.due_date) < new Date();
    });

    return !!(
      hasPendingConditions ||
      hasHighRisk ||
      lockExpiringSoon ||
      hasOverdueMilestones
    );
  }, [loan, conditions, riskScore, milestones, isRoleAllowed]);

  const fetchThreads = useCallback(async () => {
    if (!isRoleAllowed || !user?.id || !loanId) return;
    try {
      // MCT Lite: ai_chat_threads only has id/title/user_id/created_at/updated_at.
      // Filter client-side by loan_id stored in title prefix (best-effort).
      const { data, error } = await supabase
        .from("ai_chat_threads")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ id: string; title: string | null; updated_at: string }>;
      setThreads(
        rows.map((r) => ({ id: r.id, title: r.title, last_message_at: r.updated_at })) as CoachingThread[],
      );
    } catch (e) {
      console.error("Fetch coaching threads:", e);
    }
  }, [user?.id, loanId, isRoleAllowed]);


  const generateAndUpdateThreadTitle = useCallback(
    async (tid: string, allMessages: CoachingMessage[], existingTitle?: string | null) => {
      // Only generate when the current title looks like our placeholder.
      const normalized = existingTitle?.trim();
      const looksPlaceholder =
        !normalized || normalized.startsWith(DEFAULT_THREAD_TITLE_PREFIX);
      if (!looksPlaceholder) return;

      const firstUser = allMessages.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      const firstAssistant =
        allMessages.find((m) => m.role === "assistant")?.content?.slice(0, 220) ?? "";
      if (!firstUser || !firstAssistant) return;

      // Non-blocking best-effort title generation: failure shouldn't block coaching.
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
        const title = String(raw)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);

        if (!title) return;

        await supabase.from("ai_chat_threads").update({ title }).eq("id", tid);
        await fetchThreads();
      } catch {
        // no-op (best effort)
      }
    },
    [fetchThreads],
  );

  const loadThread = useCallback(
    async (id: string) => {
      if (!isRoleAllowed || !user?.id) return;
      try {
        const { data, error } = await supabase
          .from("ai_chat_threads")
          .select("id, title, messages")
          .eq("id", id)
          .single();
        if (error || !data) throw error ?? new Error("Thread not found");

        const stored = (data.messages as any[]) ?? [];
        const restored: CoachingMessage[] = stored.map((m: any, i: number) => ({
          id: `stored-${i}`,
          role: m.role,
          content: String(m.content ?? ""),
          timestamp: new Date(m.timestamp ?? Date.now()),
        }));

        setProactiveSuggestion(null);
        setMessages(restored);
        setThreadId(data.id);
        threadLoadedRef.current = true;

        // If this thread still has the placeholder title, lazily upgrade it
        // when the user opens the conversation.
        if (!titleGeneratedRef.current[data.id]) {
          const t = typeof data.title === "string" ? data.title : null;
          const looksPlaceholder = !t || t.trim().startsWith(DEFAULT_THREAD_TITLE_PREFIX);
          if (looksPlaceholder) {
            titleGeneratedRef.current[data.id] = true;
            void generateAndUpdateThreadTitle(data.id, restored, t);
          } else {
            titleGeneratedRef.current[data.id] = true;
          }
        }
      } catch (e) {
        console.error("Load coaching thread:", e);
        toast.error("Failed to load conversation");
      }
    },
    [user?.id, isRoleAllowed, generateAndUpdateThreadTitle],
  );

  // Load existing thread for this loan on mount
  useEffect(() => {
    if (!isRoleAllowed || !user?.id || !loanId || threadLoadedRef.current) return;
    threadLoadedRef.current = true;

    (async () => {
      await fetchThreads();

      const { data } = await supabase
        .from("ai_chat_threads")
        .select("id, title, messages")
        .eq("user_id", user.id)
        .eq("agent_slug", AGENT_SLUG)
        .contains("metadata", { loan_id: loanId })
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setThreadId(data.id);
        const stored = (data.messages as any[]) ?? [];
        const restored: CoachingMessage[] = stored.map((m: any, i: number) => ({
          id: `stored-${i}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp ?? Date.now()),
        }));

        setMessages(restored);

        // Upgrade placeholder title for the most recent thread (best effort).
        const t = typeof data.title === "string" ? data.title : null;
        if (!titleGeneratedRef.current[data.id]) {
          const looksPlaceholder = !t || t.trim().startsWith(DEFAULT_THREAD_TITLE_PREFIX);
          if (looksPlaceholder) {
            titleGeneratedRef.current[data.id] = true;
            void generateAndUpdateThreadTitle(data.id, restored, t);
          } else {
            titleGeneratedRef.current[data.id] = true;
          }
        }
      }
    })();
  }, [user?.id, loanId, fetchThreads, isRoleAllowed]);

  const saveThread = useCallback(
    async (msgs: CoachingMessage[], existingThreadId: string | null) => {
      if (!user?.id || !loanId) return existingThreadId;

      const payload = msgs.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));

      if (existingThreadId) {
        await supabase
          .from("ai_chat_threads")
          .update({
            messages: payload as any,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", existingThreadId);
        return existingThreadId;
      }

      const { data } = await supabase
        .from("ai_chat_threads")
        .insert({
          user_id: user.id,
          agent_slug: AGENT_SLUG,
          title: `Coaching: Loan #${loan?.loan_number ?? loanId.slice(0, 8)}`,
          messages: payload as any,
          metadata: { loan_id: loanId },
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      return data?.id ?? null;
    },
    [user?.id, loanId, loan?.loan_number],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!isRoleAllowed) {
        toast.error("You don't have permission to use the Loan Coaching Agent.");
        return;
      }
      if (!content.trim() || !user || !loanContext) {
        toast.error("Cannot send message — loan data not loaded yet.");
        return;
      }

      const userMsg: CoachingMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        const chatMessages = updatedMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const { data, error } = await supabase.functions.invoke(
          "loan-coaching-agent",
          {
            body: {
              messages: chatMessages,
              loan_context: loanContext,
              mode: "chat",
              model: "gpt-4o-mini",
              temperature: 0.6,
            },
          },
        );

        if (error) throw error;

        const aiContent =
          data?.choices?.[0]?.message?.content ??
          "Sorry, I couldn't generate a response.";

        const aiMsg: CoachingMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: aiContent,
          timestamp: new Date(),
        };

        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);

        const newThreadId = await saveThread(finalMessages, threadId);
        if (newThreadId && newThreadId !== threadId) setThreadId(newThreadId);
        // Keep the thread picker in sync (new conversation appears after first user message).
        await fetchThreads();

      // Generate a meaningful thread title once per thread.
      if (newThreadId && !titleGeneratedRef.current[newThreadId]) {
        titleGeneratedRef.current[newThreadId] = true;
        const existingTitle = threads.find((t) => t.id === newThreadId)?.title ?? null;
        void generateAndUpdateThreadTitle(newThreadId, finalMessages, existingTitle);
      }
      } catch (err: any) {
        const errorMsg: CoachingMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${err.message || "Failed to reach the coaching agent. Check edge function deployment."}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        toast.error("Coaching agent error");
      } finally {
        setIsLoading(false);
      }
    },
    [user, loanContext, messages, threadId, saveThread, fetchThreads, isRoleAllowed, threads, generateAndUpdateThreadTitle],
  );

  const fetchProactiveSuggestion = useCallback(async () => {
    if (!isRoleAllowed || !loanContext || isLoadingProactive) return;
    setIsLoadingProactive(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "loan-coaching-agent",
        {
          body: {
            messages: [],
            loan_context: loanContext,
            mode: "proactive_suggestion",
            model: "gpt-4o-mini",
            temperature: 0.5,
          },
        },
      );

      if (error) throw error;

      const suggestion =
        data?.choices?.[0]?.message?.content ?? null;
      setProactiveSuggestion(suggestion);
    } catch {
      // Proactive suggestion is best-effort — don't block the UI
    } finally {
      setIsLoadingProactive(false);
    }
  }, [loanContext, isLoadingProactive, isRoleAllowed]);

  const clearThread = useCallback(async () => {
    setMessages([]);
    setProactiveSuggestion(null);
    setThreadId(null);
    threadLoadedRef.current = false;
  }, []);

  return {
    messages,
    isLoading,
    isLoadingProactive,
    needsAttention,
    proactiveSuggestion,
    loanContextReady: loanContext !== null,
    sendMessage,
    fetchProactiveSuggestion,
    clearThread,
    threads,
    threadId,
    loadThread,
    refreshThreads: fetchThreads,
  };
}
