import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  GraduationCap,
  Send,
  Loader2,
  Lightbulb,
  RotateCcw,
  Bot,
  User,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLoanCoachingAgent,
  type CoachingMessage,
} from "@/hooks/useLoanCoachingAgent";
import { useChatScrollToBottom } from "@/hooks/useChatScrollToBottom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface LoanCoachingPanelProps {
  loanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MessageBubble({ message }: { message: CoachingMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-muted rounded-lg px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function LoanCoachingPanel({
  loanId,
  open,
  onOpenChange,
}: LoanCoachingPanelProps) {
  const {
    messages,
    isLoading,
    isLoadingProactive,
    proactiveSuggestion,
    loanContextReady,
    sendMessage,
    fetchProactiveSuggestion,
    clearThread,
    threads,
    threadId,
    loadThread,
    refreshThreads,
  } = useLoanCoachingAgent(loanId);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const proactiveFetchedRef = useRef(false);
  const [showCoachingTip, setShowCoachingTip] = useState(false);

  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);

  const { scrollRootRef, bottomRef, isAtBottom, scrollToBottom, scrollToBottomAfterRender } =
    useChatScrollToBottom(messages.length, isLoading);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setShowCoachingTip(false);
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    clearThread();
    proactiveFetchedRef.current = false;
    setShowCoachingTip(false);
    setInput("");
  };

  const handleSelectThread = async (id: string) => {
    setInput("");
    proactiveFetchedRef.current = true;
    setShowCoachingTip(false);
    await loadThread(id);
    scrollToBottomAfterRender();
  };

  const handleShowCoachingTip = () => {
    setShowCoachingTip(true);
    if (!loanContextReady || isLoadingProactive) return;
    if (!proactiveSuggestion) {
      proactiveFetchedRef.current = true;
      fetchProactiveSuggestion();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Loan Coach
          </SheetTitle>
          <SheetDescription>
            Your AI underwriter coach — ask about guidelines, next steps,
            or get help with this loan.
          </SheetDescription>
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New conversation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowCoachingTip}
                className="gap-1.5"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Coaching tip
              </Button>
            </div>
            <SearchableSelect
              value={threadId ?? undefined}
              clearable
              placeholder="Continue a previous conversation"
              onChange={async (value) => {
                if (value === "__none__") {
                  handleNewConversation();
                  return;
                }
                await handleSelectThread(value);
              }}
              options={(threads ?? []).map((t) => ({
                value: t.id,
                label: `${t.title?.trim() || "Conversation"} · ${formatThreadTime(t.last_message_at)}`,
                icon: <MessageSquare className="h-4 w-4" />,
              }))}
              renderOption={(option) => {
                const thread = (threads ?? []).find((t) => t.id === option.value);
                const currentTitle = thread?.title?.trim() || "Conversation";

                return (
                  <div className="flex items-start justify-between gap-3 w-full min-w-0">
                    <span className="min-w-0 flex-1 text-left">
                      {option.label}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100 rounded-full mt-0.5"
                          aria-label="Rename or delete conversation"
                          onClick={(e) => {
                            // Prevent CommandItem selection when clicking the menu.
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44"
                        onClick={(e) => {
                          // Keep this menu interaction from triggering the underlying select.
                          e.stopPropagation();
                        }}
                      >
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setRenameThreadId(option.value);
                            setRenameTitle(currentTitle);
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
                            setDeleteThreadId(option.value);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              }}
              className="w-full"
            />
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea ref={scrollRootRef} className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {/* Proactive suggestion */}
            {showCoachingTip && proactiveSuggestion && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Coaching Tip
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-amber-900 dark:text-amber-100 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {proactiveSuggestion}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {showCoachingTip && isLoadingProactive && !proactiveSuggestion && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing loan for coaching tips…
              </div>
            )}

            {/* Empty state when no proactive and no messages */}
            {messages.length === 0 && (!showCoachingTip || (!isLoadingProactive && !proactiveSuggestion)) && (
              <div className="text-center py-8 space-y-3">
                <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ask your Loan Coach anything
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Get guidance on conditions, guidelines, next steps, or risk
                    mitigation for this loan.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    "What should I do next on this loan?",
                    "Are there any missing documents?",
                    "Explain the risk factors",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="text-xs border rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {!showCoachingTip && messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {!showCoachingTip && isLoading && <TypingIndicator />}

            <div ref={bottomRef} className="h-1" />
          </div>
        </ScrollArea>

        {/* Scroll-to-bottom button */}
        {!showCoachingTip && !isAtBottom && messages.length > 3 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full shadow-md"
              onClick={scrollToBottom}
            >
              Scroll to bottom
            </Button>
          </div>
        )}

        <Separator />

        {/* Input */}
        <div className="px-4 py-3 shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your loan coach…"
              disabled={isLoading || !loanContextReady}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !loanContextReady}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!loanContextReady && (
            <p className="text-xs text-muted-foreground mt-1">
              Loading loan data…
            </p>
          )}
        </div>

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
                    await refreshThreads();
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
              <AlertDialogCancel onClick={() => setDeleteThreadId(null)}>
                Cancel
              </AlertDialogCancel>
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
                      clearThread();
                      setInput("");
                    }
                    await refreshThreads();
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
      </SheetContent>
    </Sheet>
  );
}
