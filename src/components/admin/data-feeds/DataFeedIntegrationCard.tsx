// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * GSE / credit data feed — persists to integration_settings (same pattern as OpenAI).
 * Vendors differ; we store API key + base URL + notes for sync jobs and ops.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  useIntegrationSetting,
  useSaveIntegrationSetting,
  useValidateIntegrationKey,
  useDeleteIntegrationSetting,
  useToggleIntegrationStatus,
} from '@/hooks/useIntegrationSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useSyncDataFeed } from '@/hooks/useSyncDataFeed';

import type { DataFeedProviderId } from '@/lib/data-feeds';

export type { DataFeedProviderId } from '@/lib/data-feeds';

export interface DataFeedMeta {
  provider: DataFeedProviderId;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  accentColor: string;
}

interface DataFeedIntegrationCardProps {
  meta: DataFeedMeta;
}

export function DataFeedIntegrationCard({ meta }: DataFeedIntegrationCardProps) {
  const { provider, name, description, category, icon, accentColor } = meta;
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [syncPath, setSyncPath] = useState('/');
  const [notes, setNotes] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: integration, isLoading } = useIntegrationSetting(provider);
  const saveMutation = useSaveIntegrationSetting();
  const validateMutation = useValidateIntegrationKey();
  const deleteMutation = useDeleteIntegrationSetting();
  const toggleMutation = useToggleIntegrationStatus();
  const syncMutation = useSyncDataFeed(provider);

  const config = (integration?.config ?? {}) as Record<string, string>;

  useEffect(() => {
    if (!integration || isEditing) return;
    const c = (integration.config ?? {}) as Record<string, string>;
    setBaseUrl(c.base_url || '');
    setNotes(c.notes || '');
    setSyncPath(c.sync_path?.trim() || '/');
  }, [integration, isEditing]);

  const handleSave = async () => {
    const keyToSave = apiKey.trim() || integration?.api_key || '';
    const base = baseUrl.trim();
    const noteText = notes.trim();
    if (!keyToSave && !base) {
      return;
    }

    await saveMutation.mutateAsync({
      provider_name: provider,
      api_key: keyToSave || '',
      config: {
        ...config,
        base_url: base,
        sync_path: syncPath.trim() || '/',
        notes: noteText,
      },
    });

    setApiKey('');
    setIsEditing(false);
    setShowKey(false);
  };

  const handleValidate = async () => {
    const base = baseUrl.trim() || config.base_url || '';
    await validateMutation.mutateAsync({
      provider_name: provider,
      api_key: apiKey.trim() || integration?.api_key || '',
      data_feed_base_url: base || undefined,
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(provider);
    setApiKey('');
    setBaseUrl('');
    setSyncPath('/');
    setNotes('');
    setIsEditing(false);
  };

  const handleToggle = async () => {
    if (!integration) return;
    await toggleMutation.mutateAsync({
      provider_name: provider,
      is_active: !integration.is_active,
    });
  };

  const hasCredentialOrUrl =
    Boolean(apiKey.trim()) ||
    Boolean(baseUrl.trim()) ||
    Boolean(integration?.api_key) ||
    Boolean(integration?.api_key_masked) ||
    Boolean((config.base_url || '').trim());

  const hasConfig = Boolean(
    integration?.api_key || integration?.api_key_masked || (config.base_url || '').trim(),
  );

  const statusBadge = () => {
    if (!hasConfig) return <Badge variant="outline">Not configured</Badge>;
    if (!integration?.is_active) return <Badge variant="secondary">Disabled</Badge>;
    switch (integration?.validation_status) {
      case 'valid':
        return (
          <Badge className="bg-emerald-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Valid
          </Badge>
        );
      case 'invalid':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Invalid
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="outline">Not tested</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col overflow-hidden">
        <div className={cn('h-1 w-full', accentColor)} />
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className={cn('h-1 w-full', accentColor)} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted',
              )}
            >
              {icon}
            </div>
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {name}
                {statusBadge()}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{category}</p>
            </div>
          </div>
          {hasConfig && (
            <div className="flex shrink-0 items-center gap-2">
              <Switch checked={!!integration?.is_active} onCheckedChange={handleToggle} disabled={toggleMutation.isPending} />
              <span className="text-xs text-muted-foreground">{integration?.is_active ? 'On' : 'Off'}</span>
            </div>
          )}
        </div>
        <CardDescription className="pt-1 text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        {hasConfig && !isEditing && (
          <div className="space-y-2 text-sm">
            <div className="grid gap-1">
              <span className="text-muted-foreground">Base URL</span>
              <span className="font-mono text-xs break-all">{config.base_url || '—'}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Sync path</span>
              <span className="font-mono text-xs break-all">{config.sync_path || '/'}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">API key</span>
              <span className="font-mono">{integration?.api_key_masked || '—'}</span>
            </div>
            {config.notes && (
              <div className="grid gap-1">
                <span className="text-muted-foreground">Notes</span>
                <span className="text-xs whitespace-pre-wrap">{config.notes}</span>
              </div>
            )}
            {integration?.last_validated_at && (
              <p className="text-xs text-muted-foreground">
                Last validated: {new Date(integration.last_validated_at).toLocaleString()}
              </p>
            )}
            {integration?.validation_error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{integration.validation_error}</AlertDescription>
              </Alert>
            )}
            {(config.last_sync_at || config.last_sync_http_status) && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">Last sync</p>
                <p className="text-muted-foreground">
                  {config.last_sync_at
                    ? new Date(config.last_sync_at).toLocaleString()
                    : '—'}{' '}
                  {config.last_sync_http_status != null && (
                    <span className="font-mono">· HTTP {config.last_sync_http_status}</span>
                  )}
                  {config.last_sync_item_count != null && (
                    <span> · {config.last_sync_item_count} item(s)</span>
                  )}
                </p>
                <p className="mt-2 text-muted-foreground">
                  Sync does not import rows into Loans or a Contacts page yet — it only stores a short API preview below
                  for debugging. Full CRM sync would be a separate feature.
                </p>
                {config.last_sync_preview ? (
                  <pre className="mt-2 max-h-48 overflow-auto rounded border bg-background p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
                    {config.last_sync_preview}
                  </pre>
                ) : null}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBaseUrl(config.base_url || '');
                  setNotes(config.notes || '');
                  setSyncPath(config.sync_path?.trim() || '/');
                  setIsEditing(true);
                }}
              >
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes stored credentials for this data feed from Control Tower.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {(!hasConfig || isEditing) && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${provider}-base`}>API base URL (optional)</Label>
              <Input
                id={`${provider}-base`}
                placeholder="https://api.vendor.example/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Root URL your vendor or aggregator documents for this feed.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${provider}-sync-path`}>Sync path</Label>
              <Input
                id={`${provider}-sync-path`}
                placeholder="/"
                value={syncPath}
                onChange={(e) => setSyncPath(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Appended to base URL for <strong>Sync now</strong> (GET with Bearer token if key is set). Default /.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${provider}-key`}>API key / client secret (optional)</Label>
              <div className="relative">
                <Input
                  id={`${provider}-key`}
                  type={showKey ? 'text' : 'password'}
                  placeholder={integration?.api_key_masked ? 'Leave blank to keep saved key' : 'Paste key'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${provider}-notes`}>Internal notes (optional)</Label>
              <Textarea
                id={`${provider}-notes`}
                placeholder="Subscription ID, contact, or rollout notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Save at least an API key or a base URL. Use <strong>Sync now</strong> (after save) to run a test GET and
                record last sync metadata.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending || !hasCredentialOrUrl}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setApiKey('');
                    setBaseUrl(config.base_url || '');
                    setSyncPath(config.sync_path?.trim() || '/');
                    setNotes(config.notes || '');
                    setShowKey(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {hasConfig && (
          <div className="border-t pt-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleValidate} disabled={validateMutation.isPending}>
                {validateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Test configuration
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={
                  syncMutation.isPending ||
                  !integration?.is_active ||
                  !(config.base_url || '').trim()
                }
                title={
                  !(config.base_url || '').trim()
                    ? 'Save a base URL first.'
                    : !integration?.is_active
                      ? 'Enable this integration to sync.'
                      : undefined
                }
              >
                {syncMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync now
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Test runs validation. Sync now performs a GET to base URL + sync path and stores HTTP status and a short
              preview in integration config (vendor-specific contract).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DataFeedIntegrationCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-muted" />
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
