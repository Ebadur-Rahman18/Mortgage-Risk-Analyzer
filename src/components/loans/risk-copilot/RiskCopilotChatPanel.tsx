import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send } from "lucide-react";
import {
  useMortgageRiskChatHistory,
  useSendMortgageRiskChat,
} from "@/hooks/useMortgageRiskChat";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { formatDate } from "@/lib/utils";

interface RiskCopilotChatPanelProps {
  loanId: string;
}

export function RiskCopilotChatPanel({ loanId }: RiskCopilotChatPanelProps) {
  const { hasPermission } = useEffectivePermissions();
  const canChat = hasPermission("loan_risk_chat:use");
  const { data: messages = [], isLoading } = useMortgageRiskChatHistory(loanId);
  const sendChat = useSendMortgageRiskChat(loanId);
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sendChat.isPending) return;
    setInput("");
    await sendChat.mutateAsync(text);
  };

  if (!canChat) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Risk Copilot Chat
        </CardTitle>
        <CardDescription>
          Ask mortgage-specific questions about this loan file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border p-3">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No messages yet. Ask about risk factors, DTI, or required documents.
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === "user"
                    ? "ml-8 rounded-lg bg-primary/10 p-3 text-sm"
                    : "mr-8 rounded-lg bg-muted p-3 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(msg.created_at)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about this mortgage application…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0 self-end"
            disabled={!input.trim() || sendChat.isPending}
            onClick={() => void handleSend()}
          >
            {sendChat.isPending ? (
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
