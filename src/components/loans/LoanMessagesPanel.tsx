import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalMessages, useSendStaffMessage } from "@/hooks/usePortalMessages";

interface Props {
  loanId: string;
  borrowerId: string;
}

export function LoanMessagesPanel({ loanId, borrowerId }: Props) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = usePortalMessages(loanId);
  const sendMut = useSendStaffMessage();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const unread = messages.filter((m) => m.sender_type === "borrower" && !m.is_read).length;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function handleSend() {
    const body = draft.trim();
    if (!body || !user) return;
    sendMut.mutate({
      loan_id: loanId,
      borrower_id: borrowerId,
      body,
      sender_user_id: user.id,
    });
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Borrower Messages
          {unread > 0 && (
            <Badge className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {unread} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-2" ref={scrollRef}>
            <div className="flex flex-col gap-2 py-1">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages with the borrower yet.
                </p>
              )}
              {messages.map((m) => {
                const isStaff = m.sender_type === "staff";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      isStaff ? "self-end items-end" : "self-start items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm",
                        isStaff
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md",
                      )}
                    >
                      {m.body}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {isStaff ? "You" : "Borrower"} · {formatTime(m.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2 items-end border-t pt-2">
          <Textarea
            placeholder="Type a message to the borrower…"
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMut.isPending}
          />
          <Button
            size="icon"
            className="shrink-0 h-10 w-10"
            disabled={!draft.trim() || sendMut.isPending}
            onClick={handleSend}
          >
            {sendMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
