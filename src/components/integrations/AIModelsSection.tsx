/**
 * AI Models Section Component
 * Displays and manages AI models for AI providers within the integration detail page
 * Note: Requires ai_providers and ai_models tables to be created in database
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Calculator,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AIModel {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  category: 'chat' | 'embedding';
  context_window: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  embedding_cost_per_1k: number;
  enabled: boolean;
  is_default: boolean;
  features: Record<string, boolean> | null;
}

interface AIModelsSectionProps {
  providerId: string;
  providerSlug: string;
  providerName: string;
  isConnected: boolean;
}

export function AIModelsSection({
  providerId,
  providerSlug,
  providerName,
  isConnected,
}: AIModelsSectionProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Cost calculator state
  const [inputTokens, setInputTokens] = useState(1000);
  const [outputTokens, setOutputTokens] = useState(1000);
  const [embeddingTokens, setEmbeddingTokens] = useState(1000);

  useEffect(() => {
    // Simulate loading - tables don't exist yet
    setLoading(false);
    setModels([]);
  }, [providerId]);

  const calculateCost = (model: AIModel) => {
    const inputCost = (inputTokens / 1000) * model.input_cost_per_1k;
    const outputCost = (outputTokens / 1000) * model.output_cost_per_1k;
    const embeddingCost =
      model.category === 'embedding'
        ? (embeddingTokens / 1000) * model.embedding_cost_per_1k
        : 0;
    return inputCost + outputCost + embeddingCost;
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Models</CardTitle>
          <CardDescription>
            Connect {providerName} to manage AI model settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Connect the provider to view available models</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Models</CardTitle>
          <CardDescription>Loading models...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Models</CardTitle>
          <CardDescription>
            AI model configuration for {providerName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                No AI models configured
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                AI models will be available after database migration is complete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg">AI Models</CardTitle>
          <CardDescription>
            Configure which {providerName} models are available for use
          </CardDescription>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Calculator className="h-4 w-4 mr-2" />
              Cost Calculator
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Token Cost Calculator</DialogTitle>
              <DialogDescription>
                Estimate costs based on token usage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div>
                  <Label>Input Tokens</Label>
                  <Input
                    type="number"
                    value={inputTokens}
                    onChange={(e) => setInputTokens(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <Label>Output Tokens</Label>
                  <Input
                    type="number"
                    value={outputTokens}
                    onChange={(e) => setOutputTokens(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <Label>Embedding Tokens</Label>
                  <Input
                    type="number"
                    value={embeddingTokens}
                    onChange={(e) => setEmbeddingTokens(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
              <div className="space-y-2 border-t pt-4">
                <p className="font-semibold">Estimated Costs:</p>
                {models.map((model) => (
                  <div key={model.id} className="flex justify-between text-sm">
                    <span>{model.name}</span>
                    <span className="font-medium">
                      ${calculateCost(model).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <p>AI model management coming soon</p>
        </div>
      </CardContent>
    </Card>
  );
}
