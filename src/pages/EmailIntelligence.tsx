import { useMemo, useState } from "react";
import {
  useGmailConnection,
  useEmailMessages,
  useEmailAttachments,
  useGmailOAuthStart,
  useGmailSync,
  useGmailDisconnect,
  downloadGmailAttachment,
} from "@/hooks/useEmailIntelligence";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentEnabled, EMAIL_INTELLIGENCE_AGENT_SLUG } from "@/hooks/useAgentEnabled";
import { useAIAgentBySlug } from "@/hooks/useAIAgents";
import { useLoans } from "@/hooks/useLoans";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Unplug, Download, Sparkles, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

/** Postgres `uuid` type — reject loan numbers like DEMO-2026-0050 mistaken for loan_id. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidString(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/**
 * Resolves AI `loan_id`: UUID passthrough, or lookup by `loan_number`, else message link fallback.
 */
async function resolveLoanIdForEmailAction(
  raw: unknown,
  fallbackLoanId: string | null | undefined,
  loanNumberLookupCache: Map<string, string | null>,
): Promise<string | null> {
  const fb =
    typeof fallbackLoanId === "string" && isUuidString(fallbackLoanId)
      ? fallbackLoanId.trim()
      : null;
  if (raw === null || raw === undefined) return fb;
  const s = String(raw).trim();
  if (s === "") return fb;
  if (isUuidString(s)) return s;
  if (loanNumberLookupCache.has(s)) {
    const cached = loanNumberLookupCache.get(s);
    return cached && isUuidString(cached) ? cached : fb;
  }
  const { data, error } = await supabase
    .from("loans")
    .select("id")
    .eq("loan_number", s)
    .maybeSingle();
  if (error || !data?.id) {
    loanNumberLookupCache.set(s, null);
    return fb;
  }
  const id = String(data.id);
  if (!isUuidString(id)) {
    loanNumberLookupCache.set(s, null);
    return fb;
  }
  loanNumberLookupCache.set(s, id);
  return id;
}

function tryParseActionItemsJson(text: string): Array<{
  title: string;
  description?: string;
  priority?: string;
  suggested_due_date?: string | null;
  loan_id?: string | null;
}> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as { title?: unknown }).title === "string"
    ) {
      return [parsed as (typeof parsed & { title: string })];
    }
  } catch {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* ignore */
      }
    }
  }
  return [];
}

export default function EmailIntelligence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isEnabled, isLoading: agentLoading } = useAgentEnabled(EMAIL_INTELLIGENCE_AGENT_SLUG);
  const { data: agentRow } = useAIAgentBySlug(EMAIL_INTELLIGENCE_AGENT_SLUG);
  const { data: connection, isLoading: connLoading } = useGmailConnection();
  const { data: messages = [], isLoading: msgLoading } = useEmailMessages();
  /** Full list for link dropdown (paginated `page: 1` only showed ~25 loans for everyone, including admins). */
  const { data: loansResult } = useLoans();
  const loans = loansResult?.rows ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  );
  const { data: attachments = [] } = useEmailAttachments(selected?.id);

  const startOAuth = useGmailOAuthStart();
  const sync = useGmailSync();
  const disconnect = useGmailDisconnect();

  const [aiOutput, setAiOutput] = useState("");
  const [draftOutput, setDraftOutput] = useState("");
  const [runBusy, setRunBusy] = useState<"extract" | "draft" | null>(null);

  const updateLoan = useMutation({
    mutationFn: async ({ id, loan_id }: { id: string; loan_id: string | null }) => {
      const { error } = await supabase
        .from("email_messages")
        .update({ loan_id, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailIntelligence.messages({}) });
      toast.success("Loan link updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createActionsFromAi = useMutation({
    mutationFn: async (items: ReturnType<typeof tryParseActionItemsJson>) => {
      if (!user?.id || !agentRow?.id) throw new Error("Missing user or agent");
      const loanNumberLookupCache = new Map<string, string | null>();
      for (const it of items) {
        const title = (it.title ?? "").trim();
        if (!title) continue;
        const priority =
          it.priority === "high" || it.priority === "low" ? it.priority : "normal";
        const due = it.suggested_due_date ? String(it.suggested_due_date).slice(0, 10) : null;
        const resolvedLoanId = await resolveLoanIdForEmailAction(
          it.loan_id,
          selected?.loan_id,
          loanNumberLookupCache,
        );
        const safeLoanId =
          resolvedLoanId && isUuidString(resolvedLoanId) ? resolvedLoanId : null;
        const { error } = await supabase.from("action_items").insert({
          title,
          description: it.description ?? null,
          assigned_to_user_id: user.id,
          loan_id: safeLoanId,
          agent_id: agentRow.id,
          source: "email",
          priority,
          status: "not_started",
          due_date: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
          watchers: [user.id],
          created_by_user_id: user.id,
          assigned_by_user_id: null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Action items created");
      setAiOutput("");
      invalidateKeys.actionItems(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAi = async (mode: "extract" | "draft") => {
    if (!selected || !agentRow?.slug) {
      toast.error("Select a message first");
      return;
    }
    setRunBusy(mode);
    setAiOutput("");
    setDraftOutput("");
    const input =
      mode === "extract"
        ? `Analyze this email and return ONLY a JSON array of action items. Each item: {"title": string, "description": string, "priority": "high"|"normal"|"low", "suggested_due_date": "YYYY-MM-DD"|null, "loan_id": "<uuid>"|null}.\nloan_id must be a real database UUID for the loan, or null. Never put the loan number (e.g. DEMO-2026-0001) in loan_id — use null and mention the loan number in the description instead.\n\nSubject: ${selected.subject ?? ""}\nFrom: ${selected.from_address ?? ""}\n\nBody:\n${selected.body_text ?? selected.snippet ?? ""}`
        : `Draft a short professional reply (plain text only) to this email.\n\nSubject: ${selected.subject ?? ""}\nFrom: ${selected.from_address ?? ""}\n\nBody:\n${selected.body_text ?? selected.snippet ?? ""}`;

    try {
      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: { agent_slug: agentRow.slug, input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      const out = (data?.output as string) ?? "";
      if (mode === "extract") setAiOutput(out);
      else setDraftOutput(out);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunBusy(null);
    }
  };

  const handleConnect = () => {
    startOAuth.mutate(undefined, {
      onSuccess: (d) => {
        if (d?.authUrl) window.location.href = d.authUrl;
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (agentLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Email Intelligence</CardTitle>
          <CardDescription>
            This agent is disabled. Ask an administrator to enable &quot;Email Intelligence&quot; in
            Admin → AI Agents.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Intelligence</h1>
        <p className="mt-1 text-muted-foreground">
          Connect Gmail, sync messages, extract actions, link loans, and draft replies.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Gmail connection</CardTitle>
            <CardDescription>
              Uses read-only Gmail access. Add{" "}
              <code className="rounded bg-muted px-1 text-xs">
                {typeof window !== "undefined" ? window.location.origin : ""}
                /email-intelligence/callback
              </code>{" "}
              as an authorized redirect URI in Google Cloud Console.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {connection ? (
              <>
                <Badge variant="secondary">{connection.email_address}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sync.mutate(25)}
                  disabled={sync.isPending}
                >
                  {sync.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() =>
                    disconnect.mutate(undefined, {
                      onSuccess: () => toast.success("Gmail disconnected"),
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                  disabled={disconnect.isPending}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnect} disabled={startOAuth.isPending}>
                {startOAuth.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Connect Gmail
              </Button>
            )}
          </div>
        </CardHeader>
        {connection?.last_sync_at && (
          <CardContent className="text-xs text-muted-foreground">
            Last sync: {format(new Date(connection.last_sync_at), "PPpp")}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-lg">Inbox (synced)</CardTitle>
            <CardDescription>Recent messages stored from Gmail</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {connLoading || msgLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[360px] px-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-sm text-muted-foreground">
                    {connection ? "No messages yet — run Sync now." : "Connect Gmail to sync."}
                  </p>
                ) : (
                  <ul className="space-y-1 pb-4">
                    {messages.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(m.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            selectedId === m.id
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:bg-muted/80"
                          }`}
                        >
                          <div className="font-medium line-clamp-1">{m.subject || "(No subject)"}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{m.snippet}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {m.internal_date
                              ? format(new Date(m.internal_date), "PPp")
                              : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-lg">Message detail</CardTitle>
            <CardDescription>
              Link a loan, download attachments, run AI extraction or draft a reply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a message from the list.</p>
            ) : (
              <>
                <div>
                  <div className="text-sm font-medium">{selected.subject || "(No subject)"}</div>
                  <div className="text-xs text-muted-foreground">
                    From {selected.from_address ?? "—"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Link to loan</Label>
                  <Select
                    value={selected.loan_id ?? "_none"}
                    onValueChange={(v) =>
                      updateLoan.mutate({
                        id: selected.id,
                        loan_id: v === "_none" ? null : v,
                      })
                    }
                    disabled={updateLoan.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {loans.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.loan_number ?? l.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="max-h-40 rounded-md border p-3 text-sm">
                  {selected.body_text || selected.snippet || "—"}
                </ScrollArea>

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Attachments</Label>
                    <ul className="space-y-1">
                      {attachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{a.filename ?? a.gmail_attachment_id}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadGmailAttachment({
                                message_id: selected.id,
                                gmail_attachment_id: a.gmail_attachment_id,
                                filename: a.filename,
                              }).catch((e: Error) => toast.error(e.message))
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!!runBusy}
                    onClick={() => runAi("extract")}
                  >
                    {runBusy === "extract" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Extract actions
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!!runBusy}
                    onClick={() => runAi("draft")}
                  >
                    {runBusy === "draft" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Draft reply
                  </Button>
                </div>

                {aiOutput && (
                  <div className="space-y-2">
                    <Label>AI — action items (raw)</Label>
                    <Textarea value={aiOutput} readOnly className="min-h-[120px] font-mono text-xs" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const items = tryParseActionItemsJson(aiOutput);
                        if (items.length === 0) {
                          toast.error("Could not parse JSON action items from AI output");
                          return;
                        }
                        createActionsFromAi.mutate(items);
                      }}
                      disabled={createActionsFromAi.isPending}
                    >
                      {createActionsFromAi.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ListPlus className="mr-2 h-4 w-4" />
                      )}
                      Create action items
                    </Button>
                  </div>
                )}

                {draftOutput && (
                  <div className="space-y-2">
                    <Label>AI — draft reply</Label>
                    <Textarea
                      value={draftOutput}
                      onChange={(e) => setDraftOutput(e.target.value)}
                      className="min-h-[120px] text-sm"
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
