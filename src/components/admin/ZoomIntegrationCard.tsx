// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * Zoom Server-to-Server OAuth — credentials in integration_settings (mirrors LendingPad card pattern).
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Video,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  useIntegrationSetting,
  useSaveIntegrationSetting,
  useValidateIntegrationKey,
  useDeleteIntegrationSetting,
  useToggleIntegrationStatus,
  integrationSettingsKeys,
} from '@/hooks/useIntegrationSettings';
import { useSyncZoom } from '@/hooks/useSyncZoom';
import { useAppConfig } from '@/hooks/useAppConfig';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';

const PROVIDER = 'zoom';

export default function ZoomIntegrationCard() {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accountId, setAccountId] = useState('');
  const [syncUserId, setSyncUserId] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: appConfig } = useAppConfig();
  const zoomSyncEnabled = appConfig?.features.enableZoomSync ?? true;

  const { data: integration, isLoading } = useIntegrationSetting(PROVIDER);
  const saveMutation = useSaveIntegrationSetting();
  const validateMutation = useValidateIntegrationKey();
  const deleteMutation = useDeleteIntegrationSetting();
  const toggleMutation = useToggleIntegrationStatus();
  const syncMutation = useSyncZoom();

  const config = (integration?.config ?? {}) as Record<string, string>;
  const hasSavedCredentials = Boolean(integration?.api_key || integration?.api_key_masked);

  useEffect(() => {
    if (!integration) return;
    const c = (integration.config ?? {}) as Record<string, string>;
    setClientId(c.client_id || '');
    setAccountId(c.account_id || '');
    setSyncUserId(c.sync_user_id || '');
  }, [integration]);

  const handleSave = async () => {
    const secret = clientSecret.trim() || integration?.api_key;
    if (!clientId.trim() || !accountId.trim() || !secret) return;

    await saveMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: secret,
      config: {
        ...config,
        client_id: clientId.trim(),
        account_id: accountId.trim(),
        sync_user_id: syncUserId.trim(),
      },
    });

    setClientSecret('');
    setIsEditing(false);
    setShowSecret(false);
  };

  const handleValidate = async () => {
    await validateMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: clientSecret.trim() || integration?.api_key || '',
      zoom_client_id: clientId.trim() || config.client_id || '',
      zoom_account_id: accountId.trim() || config.account_id || '',
    });
  };

  const handleDisconnect = async () => {
    const { error } = await supabase.functions.invoke('zoom-disconnect', { body: {} });
    if (error) {
      toast.error(error.message || 'Disconnect failed');
      return;
    }
    toast.success('Zoom disconnected (cached tokens cleared).');
    await queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
    await queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.byProvider(PROVIDER) });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(PROVIDER);
    setClientId('');
    setClientSecret('');
    setAccountId('');
    setSyncUserId('');
    setIsEditing(false);
  };

  const handleToggleStatus = async () => {
    if (!integration) return;
    await toggleMutation.mutateAsync({
      provider_name: PROVIDER,
      is_active: !integration.is_active,
    });
  };

  const handleSyncNow = () => {
    if (!zoomSyncEnabled) {
      toast.error('Turn on “Zoom meeting sync” in System Settings first.');
      return;
    }
    syncMutation.mutate({});
  };

  const getStatusBadge = () => {
    if (!hasSavedCredentials) {
      return <Badge variant="outline">Not Configured</Badge>;
    }
    if (!integration?.is_active) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    switch (integration?.validation_status) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Connected
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
      case 'not_tested':
      default:
        return <Badge variant="outline">Not Tested</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/20">
              <Video className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Zoom
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>
                Server-to-Server OAuth — sync cloud recordings into meetings (requires sync user id).
              </CardDescription>
            </div>
          </div>
          {hasSavedCredentials && integration && (
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={integration.is_active}
                onCheckedChange={handleToggleStatus}
                disabled={toggleMutation.isPending}
              />
              <span className="text-sm text-muted-foreground">
                {integration.is_active ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!zoomSyncEnabled && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Zoom sync is off in System Settings. Enable “Zoom meeting sync” to run a sync from here.
            </AlertDescription>
          </Alert>
        )}

        {hasSavedCredentials && !isEditing && (
          <div className="space-y-2">
            <Label>Saved configuration</Label>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Client ID</span>
              <span className="truncate font-mono">{config.client_id || '—'}</span>
              <span className="text-muted-foreground">Account ID</span>
              <span className="truncate font-mono">{config.account_id || '—'}</span>
              <span className="text-muted-foreground">Client Secret</span>
              <span className="font-mono">{integration.api_key_masked || '••••••••••••'}</span>
              <span className="text-muted-foreground">Sync user (Zoom)</span>
              <span className="truncate font-mono text-xs">{config.sync_user_id || '—'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setClientId(config.client_id || '');
                  setAccountId(config.account_id || '');
                  setSyncUserId(config.sync_user_id || '');
                  setIsEditing(true);
                }}
              >
                Update
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Zoom integration</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes stored Zoom credentials from Control Tower. You can re-add them anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {integration.last_validated_at && (
              <p className="text-xs text-muted-foreground">
                Last tested: {new Date(integration.last_validated_at).toLocaleString()}
              </p>
            )}

            {integration.validation_error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{integration.validation_error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {(!hasSavedCredentials || isEditing) && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="zoom-client-id">
                  Client ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="zoom-client-id"
                  placeholder="From Zoom S2S app"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zoom-account-id">
                  Account ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="zoom-account-id"
                  placeholder="Zoom account id"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zoom-client-secret">
                Client Secret <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="zoom-client-secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder={integration?.api_key ? 'Leave blank to keep existing secret' : 'S2S client secret'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zoom-sync-user">Sync user ID or email</Label>
              <Input
                id="zoom-sync-user"
                placeholder="Zoom user whose recordings to list (e.g. you@company.com)"
                value={syncUserId}
                onChange={(e) => setSyncUserId(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Required for sync: API{' '}
                <code className="rounded bg-muted px-1">GET /users/&#123;userId&#125;/recordings</code>. Override
                with <code className="rounded bg-muted px-1">ZOOM_SYNC_USER_ID</code> secret if you use env-only
                credentials.
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Create a <strong>Server-to-Server OAuth</strong> app in the{' '}
                <a
                  href="https://marketplace.zoom.us/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  Zoom Marketplace
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
                . Use <code className="rounded bg-muted px-1">grant_type=account_credentials</code> (token URL{' '}
                <code className="rounded bg-muted px-1">https://zoom.us/oauth/token</code>) per Zoom docs. Add scopes for
                listing recordings (e.g. <code className="rounded bg-muted px-1">cloud_recording:read:list_user_recordings</code>
                ). You can set <code className="rounded bg-muted px-1">ZOOM_*</code> secrets instead of saving here.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSave}
                disabled={
                  !clientId.trim() ||
                  !accountId.trim() ||
                  (!clientSecret.trim() && !integration?.api_key) ||
                  saveMutation.isPending
                }
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save configuration
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setClientSecret('');
                    setShowSecret(false);
                    setClientId(config.client_id || '');
                    setAccountId(config.account_id || '');
                    setSyncUserId(config.sync_user_id || '');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {hasSavedCredentials && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleValidate} disabled={validateMutation.isPending}>
              {validateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSyncNow}
              disabled={syncMutation.isPending || !integration.is_active || !zoomSyncEnabled}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync now
            </Button>
          </div>
        )}

        {integration?.is_active && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Recordings from the last 30 days are merged into <code className="rounded bg-muted px-1">zoom_files</code>{' '}
              and linked to meetings when <code className="rounded bg-muted px-1">zoom_meeting_id</code> or{' '}
              <code className="rounded bg-muted px-1">zoom_uuid</code> matches.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
