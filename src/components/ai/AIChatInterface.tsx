import { useState, FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Send, Bot, Loader2, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIModel {
  id: string;
  name: string;
  model_id: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  features: Record<string, boolean> | null;
  is_default: boolean;
  ai_providers: {
    name: string;
  } | null;
}

interface AIChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string, modelId?: string) => void;
  sessionId?: string;
  title?: string;
  description?: string;
  placeholder?: string;
  className?: string;
}

export function AIChatInterface({
  messages,
  isLoading,
  onSendMessage,
  sessionId,
  title = "Chat",
  description = "Ask questions, get summaries, or search your knowledge base",
  placeholder = "Type your message...",
  className,
}: AIChatInterfaceProps) {
  const { profile } = useAuth();
  const [input, setInput] = useState("");
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      // Note: ai_models table needs to be created in the database schema
      // For now, use a default model configuration
      const defaultModels: AIModel[] = [
        {
          id: "default-gpt4",
          name: "GPT-4 Turbo",
          model_id: "gpt-4-turbo-preview",
          input_cost_per_1k: 0.01,
          output_cost_per_1k: 0.03,
          features: { chat: true, streaming: true },
          is_default: true,
          ai_providers: { name: "OpenAI" },
        },
      ];

      setModels(defaultModels);
      setSelectedModel(defaultModels[0].id);
    } catch (error) {
      console.error("Failed to load AI models:", error);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onSendMessage(input, selectedModel);
    setInput("");
  };

  const selectedModelData = models.find((m) => m.id === selectedModel);
  const getCostIndicator = (model?: AIModel) => {
    if (!model) return null;
    const avgCost = (model.input_cost_per_1k + model.output_cost_per_1k) / 2;
    if (avgCost < 0.001) return { label: "Low", color: "bg-green-500" };
    if (avgCost < 0.005) return { label: "Medium", color: "bg-yellow-500" };
    return { label: "High", color: "bg-red-500" };
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {description}
              {sessionId && (
                <Badge variant="secondary" className="text-xs">
                  Session: {sessionId.slice(-8)}
                </Badge>
              )}
            </CardDescription>
          </div>
          {models.length > 1 && (
            <div className="flex items-center gap-2">
              <SearchableSelect
                value={selectedModel}
                onChange={setSelectedModel}
                className="w-[200px]"
                placeholder="Select model"
                options={models.map((model) => ({ value: model.id, label: model.name }))}
                renderOption={(opt) => {
                  const model = models.find((m) => m.id === opt.value);
                  if (!model) return opt.label;
                  const costInfo = getCostIndicator(model);
                  return (
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {costInfo && (
                        <Badge variant="outline" className="gap-1">
                          <div className={`h-2 w-2 rounded-full ${costInfo.color}`} />
                          {costInfo.label}
                        </Badge>
                      )}
                      {model.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                  );
                }}
              />
              {selectedModelData && (
                <div className="text-xs text-muted-foreground">
                  {selectedModelData.ai_providers?.name}
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-100px)] flex-col gap-4">
        {/* Messages */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="mt-1 text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(profile?.full_name || "U")}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg bg-muted p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
