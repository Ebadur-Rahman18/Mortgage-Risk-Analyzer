import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PortalMessage } from "@/lib/borrowerPortalApi";
import { sendPortalMessage, getPortalAccessToken } from "@/lib/borrowerPortalApi";

interface Props {
  messages: PortalMessage[];
  loanOfficerName: string | null;
  onNewMessage: (msg: PortalMessage) => void;
}

export function PortalMessagesCard({ messages, loanOfficerName, onNewMessage }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    const jwt = getPortalAccessToken();
    if (!jwt) return;
    setSending(true);
    try {
      const msg = await sendPortalMessage(jwt, body);
      onNewMessage(msg);
      setDraft("");
    } catch {
      // toast handled inside api
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Messages
          {loanOfficerName && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              with {loanOfficerName}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* Thread */}
        <ScrollArea className="h-[280px] sm:h-[320px] pr-2" ref={scrollRef}>
          <div className="flex flex-col gap-2 py-1">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Send a message to your loan officer.
              </p>
            )}
            {messages.map((m) => {
              const isBorrower = m.sender_type === "borrower";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    isBorrower ? "self-end items-end" : "self-start items-start",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      isBorrower
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md",
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                    {isBorrower ? "You" : loanOfficerName || "Loan Officer"} · {formatTime(m.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="flex gap-2 items-end border-t pt-2">
          <Textarea
            placeholder="Type a message…"
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <Button
            size="icon"
            className="shrink-0 h-10 w-10"
            disabled={!draft.trim() || sending}
            onClick={handleSend}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
