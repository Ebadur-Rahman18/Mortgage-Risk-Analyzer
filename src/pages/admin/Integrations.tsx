/**
 * Integration Hub - Main Page
 * Manage API keys and third-party integrations
 *
 * Coverage (expectations for this page):
 * - AI Providers: OpenAI only (save + Test → validate-api-key). Anthropic exists in the validator but has no card yet.
 * - LOS: LendingPad (integration_settings + OAuth + los-sync-lendingpad). REST paths are tenant-specific.
 * - Data Feeds: Freddie / Fannie / Credit cards → validate-api-key + sync-data-feed (vendor HTTPS URL + Bearer; not built-in public GSE APIs).
 * - Meeting providers: Zoom S2S (validate-api-key, sync-zoom-files, zoom-disconnect; System Settings can gate sync).
 * - Communication: SendGrid (validate-api-key; email send resolves via notify-credentials / SENDGRID_* secrets).
 * - Storage tab: placeholder only — no integration wired here.
 * Other admin routes: /admin/integrations/oauth/callback (OAuth return), /admin/integrations/analytics, Microsoft Teams under /admin/integrations/microsoft-teams.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Info, Sparkles, Cloud, Zap } from 'lucide-react';
import OpenAIIntegrationCard from '@/components/admin/OpenAIIntegrationCard';
import AIProviderIntegrationCard, {
  type AIProviderCardConfig,
} from '@/components/admin/AIProviderIntegrationCard';
import LendingPadIntegrationCard from '@/components/admin/LendingPadIntegrationCard';
import ZoomIntegrationCard from '@/components/admin/ZoomIntegrationCard';
import { IntegrationsGrid } from '@/components/admin/data-feeds/IntegrationsGrid';
import { DataFeedIntegrationCard, type DataFeedMeta } from '@/components/admin/data-feeds/DataFeedIntegrationCard';
import SendGridIntegrationCard from '@/components/admin/SendGridIntegrationCard';
import DocuSignIntegrationCard from '@/components/admin/DocuSignIntegrationCard';
import EncompassIntegrationCard from '@/components/admin/EncompassIntegrationCard';
import { Building2 } from 'lucide-react';

const anthropicConfig: AIProviderCardConfig = {
  providerSlug: 'anthropic',
  displayName: 'Anthropic',
  description: 'Claude models — reasoning, analysis, long context',
  icon: <Sparkles className="h-6 w-6" />,
  iconBgClass: 'bg-amber-100 dark:bg-amber-900/20',
  iconColorClass: 'text-amber-600 dark:text-amber-400',
  apiKeyPlaceholder: 'sk-ant-api03-...',
  docsUrl: 'https://console.anthropic.com/settings/keys',
  docsLabel: 'Anthropic Console',
  activeFeatures: 'AI Chat Assistant (Claude), Document Analysis, Long-context Summarisation',
};

const googleAIConfig: AIProviderCardConfig = {
  providerSlug: 'google',
  displayName: 'Google AI',
  description: 'Gemini models — multimodal, fast inference',
  icon: <Cloud className="h-6 w-6" />,
  iconBgClass: 'bg-blue-100 dark:bg-blue-900/20',
  iconColorClass: 'text-blue-600 dark:text-blue-400',
  apiKeyPlaceholder: 'AIzaSy...',
  docsUrl: 'https://aistudio.google.com/app/apikey',
  docsLabel: 'Google AI Studio',
  activeFeatures: 'AI Chat Assistant (Gemini), Multimodal Document Processing, Embeddings',
};

const perplexityConfig: AIProviderCardConfig = {
  providerSlug: 'perplexity',
  displayName: 'Perplexity',
  description: 'Online LLMs with real-time web search',
  icon: <Zap className="h-6 w-6" />,
  iconBgClass: 'bg-violet-100 dark:bg-violet-900/20',
  iconColorClass: 'text-violet-600 dark:text-violet-400',
  apiKeyPlaceholder: 'pplx-...',
  docsUrl: 'https://www.perplexity.ai/settings/api',
  docsLabel: 'Perplexity API Settings',
  activeFeatures: 'AI Chat with live web search, Research Assistance',
};

const pipelineSyncIntegrations: DataFeedMeta[] = [
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description:
      'Sync borrower and pipeline CRM fields from HubSpot. Save private app token or API key and source endpoint details used by sync jobs.',
    category: 'Pipeline Sync / CRM',
    icon: <Building2 className="h-5 w-5 text-orange-600" />,
    accentColor: 'bg-orange-600',
  },
];

export default function Integrations() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Hub</h1>
          <p className="text-muted-foreground">
            Configure API keys and third-party service integrations
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/integrations/analytics')}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </div>

      {/* Information Banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Secure Storage</AlertTitle>
        <AlertDescription>
          All API keys are encrypted and stored securely. Only administrators can view and manage integrations.
        </AlertDescription>
      </Alert>

      {/* Integrations Tabs */}
      <Tabs defaultValue="ai-providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ai-providers">AI Providers</TabsTrigger>
          <TabsTrigger value="los">Loan Origination (LOS)</TabsTrigger>
          <TabsTrigger value="data-feeds">Data Feeds</TabsTrigger>
          <TabsTrigger value="pipeline-sync">Pipeline Sync</TabsTrigger>
          <TabsTrigger value="meeting-providers">Meeting providers</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="storage" disabled>
            Storage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-providers" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <OpenAIIntegrationCard />
            <AIProviderIntegrationCard config={anthropicConfig} />
            <AIProviderIntegrationCard config={googleAIConfig} />
            {/* MCT Lite: Perplexity hidden — re-enable by uncommenting below */}
            {/* <AIProviderIntegrationCard config={perplexityConfig} /> */}
          </div>
        </TabsContent>

        <TabsContent value="los" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Loan Origination System</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Same flow as AI Providers: save credentials and OAuth in <code className="rounded bg-muted px-1">integration_settings</code>, use{' '}
              <strong>Test configuration</strong> / <strong>Connect with LendingPad</strong> to validate and complete OAuth.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <LendingPadIntegrationCard />
          </div>
        </TabsContent>

        <TabsContent value="data-feeds" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Third-Party Data Providers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Store vendor API keys and base URLs per feed; use <strong>Test configuration</strong> to validate saved settings (edge functions resolve secrets server-side).
            </p>
          </div>
          <IntegrationsGrid />
        </TabsContent>

        <TabsContent value="pipeline-sync" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pipeline Sync Integrations</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Configure HubSpot and Encompass credentials using the same secure integration pattern, then use{' '}
              <strong>Test configuration</strong> and <strong>Sync now</strong> to validate and pull pipeline data.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <EncompassIntegrationCard />
            {pipelineSyncIntegrations.map((meta) => (
              <DataFeedIntegrationCard key={meta.provider} meta={meta} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="meeting-providers" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Meeting providers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Save S2S credentials, then <strong>Test connection</strong> / <strong>Sync now</strong>. Secrets are read from the database when the browser does not return the full key.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <ZoomIntegrationCard />
          </div>
        </TabsContent>

        <TabsContent value="communication" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Email</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Same card pattern as OpenAI: save API key and sender, <strong>Test connection</strong> to hit SendGrid. Optional env fallback: <code className="rounded bg-muted px-1">SENDGRID_*</code> secrets.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <SendGridIntegrationCard />
          </div>

          {/* MCT Lite: DocuSign / E-Sign hidden — re-enable by uncommenting below */}
          {/*
          <div className="pt-4">
            <h2 className="text-base font-semibold text-foreground">E-Sign</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              DocuSign integration for borrower disclosure signing.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <DocuSignIntegrationCard />
          </div>
          */}
        </TabsContent>

        <TabsContent value="storage">
          <Alert>
            <AlertDescription>
              Storage integrations (Google Drive, Dropbox, etc.) coming soon.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
