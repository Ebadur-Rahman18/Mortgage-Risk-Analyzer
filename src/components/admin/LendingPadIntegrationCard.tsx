// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * LendingPad Integration Card
 * Follows the same pattern as OpenAIIntegrationCard — saves config to integration_settings.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';
import {
  Link2,
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
import { supabase } from '@/integrations/supabase/client';
import { getLendingPadOAuthRedirectUri } from '@/lib/lendingpad-oauth';
import { useToast } from '@/hooks/use-toast';
import { useLosSyncLendingPad } from '@/hooks/useLosSyncLendingPad';
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

const PROVIDER = 'lendingpad';

export default function LendingPadIntegrationCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [scope, setScope] = useState('loans conditions');
  const [showSecret, setShowSecret] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [oauthStarting, setOauthStarting] = useState(false);
  const [oauthDisconnecting, setOauthDisconnecting] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.lendingpad.com');
  const [loansListPath, setLoansListPath] = useState('/api/v1/loans');
  const [loanOfficerUserId, setLoanOfficerUserId] = useState('');

  const { data: integration, isLoading } = useIntegrationSetting(PROVIDER);
  const saveMutation = useSaveIntegrationSetting();
  const validateMutation = useValidateIntegrationKey();
  const deleteMutation = useDeleteIntegrationSetting();
  const toggleMutation = useToggleIntegrationStatus();
  const losSyncMutation = useLosSyncLendingPad();

  const config = (integration?.config ?? {}) as Record<string, string>;
  const hasSavedCredentials = Boolean(integration?.api_key || integration?.api_key_masked);
  const hasOAuthPrereqs =
    hasSavedCredentials &&
    Boolean(config.client_id?.trim()) &&
    Boolean(config.authorize_url?.trim()) &&
    Boolean(config.token_url?.trim());
  const hasAccessToken = Boolean((config.access_token || '').trim());

  useEffect(() => {
    if (!integration) return;
    const c = (integration.config ?? {}) as Record<string, string>;
    if (c.client_id) setClientId(c.client_id);
    if (c.authorize_url) setAuthorizeUrl(c.authorize_url);
    if (c.token_url) setTokenUrl(c.token_url);
    if (c.scope) setScope(c.scope);
    if (c.api_base_url) setApiBaseUrl(c.api_base_url);
    if (c.loans_list_path) setLoansListPath(c.loans_list_path);
    if (c.default_loan_officer_user_id) setLoanOfficerUserId(c.default_loan_officer_user_id);
  }, [integration]);

  const handleSave = async () => {
    const secret = clientSecret.trim() || integration?.api_key || '';
    if (!clientId.trim() || !secret.trim()) return;

    await saveMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: secret,
      config: {
        ...config,
        client_id: clientId.trim(),
        authorize_url: authorizeUrl.trim(),
        token_url: tokenUrl.trim(),
        scope: scope.trim(),
        api_base_url: apiBaseUrl.trim() || 'https://api.lendingpad.com',
        loans_list_path: loansListPath.trim() || '/api/v1/loans',
        default_loan_officer_user_id: loanOfficerUserId.trim(),
      },
    });

    setClientId('');
    setClientSecret('');
    setAuthorizeUrl('');
    setTokenUrl('');
    setScope('loans conditions');
    setIsEditing(false);
    setShowSecret(false);
  };

  const handleValidate = async () => {
    await validateMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: clientSecret.trim() || integration?.api_key || '',
      lendingpad_client_id: clientId.trim() || config.client_id || undefined,
      lendingpad_authorize_url: authorizeUrl.trim() || config.authorize_url || undefined,
      lendingpad_token_url: tokenUrl.trim() || config.token_url || undefined,
    });
  };

  const handleConnectLendingPad = async () => {
    const redirectUri = getLendingPadOAuthRedirectUri();
    if (!redirectUri) {
      toast({ title: 'OAuth error', description: 'Redirect URI could not be determined.', variant: 'destructive' });
      return;
    }
    setOauthStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('lendingpad-oauth-start', {
        body: { redirect_uri: redirectUri },
      });
      if (error) throw error;
      const payload = data as { error?: string; url?: string };
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.url) throw new Error('No authorization URL returned.');
      window.location.href = payload.url;
    } catch (e) {
      setOauthStarting(false);
      toast({
        title: 'Could not start LendingPad OAuth',
        description: e instanceof Error ? e.message : 'Try again or check edge function deployment.',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnectOAuth = async () => {
    setOauthDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('lendingpad-oauth-disconnect', { body: {} });
      if (error) throw error;
      const payload = data as { error?: string };
      if (payload?.error) throw new Error(payload.error);
      toast({ title: 'LendingPad OAuth cleared', description: 'Tokens were removed. Re-enable the integration if it was turned off.' });
      await queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      await queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.byProvider(PROVIDER) });
    } catch (e) {
      toast({
        title: 'Disconnect failed',
        description: e instanceof Error ? e.message : 'Could not clear OAuth tokens.',
        variant: 'destructive',
      });
    } finally {
      setOauthDisconnecting(false);
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(PROVIDER);
    setClientId('');
    setClientSecret('');
    setAuthorizeUrl('');
    setTokenUrl('');
    setIsEditing(false);
  };

  const handleToggleStatus = async () => {
    if (!integration) return;
    await toggleMutation.mutateAsync({
      provider_name: PROVIDER,
      is_active: !integration.is_active,
    });
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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <Link2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                LendingPad
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>Loan Origination System (LOS) – sync loans, conditions &amp; milestones</CardDescription>
            </div>
          </div>
          {hasSavedCredentials && integration && (
            <div className="flex items-center gap-2">
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
        {/* Current config display (configured, not editing) */}
        {hasSavedCredentials && !isEditing && (
          <div className="space-y-2">
            <Label>Saved Configuration</Label>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Client ID</span>
              <span className="font-mono truncate">{config.client_id || '—'}</span>
              <span className="text-muted-foreground">Client Secret</span>
              <span className="font-mono">{integration.api_key_masked || '••••••••••••'}</span>
              <span className="text-muted-foreground">Authorize URL</span>
              <span className="font-mono truncate text-xs">{config.authorize_url || '—'}</span>
              <span className="text-muted-foreground">Token URL</span>
              <span className="font-mono truncate text-xs">{config.token_url || '—'}</span>
              <span className="text-muted-foreground">Scope</span>
              <span className="font-mono">{config.scope || '—'}</span>
              <span className="text-muted-foreground">API base URL</span>
              <span className="font-mono truncate text-xs">{config.api_base_url || '—'}</span>
              <span className="text-muted-foreground">Loans list path</span>
              <span className="font-mono text-xs">{config.loans_list_path || '—'}</span>
              <span className="text-muted-foreground">Default loan officer (user UUID)</span>
              <span className="font-mono truncate text-xs">{config.default_loan_officer_user_id || '—'}</span>
              {config.last_sync_at && (
                <>
                  <span className="text-muted-foreground">Last loan sync</span>
                  <span className="text-xs">{new Date(config.last_sync_at).toLocaleString()}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => {
                setClientId(config.client_id || '');
                setAuthorizeUrl(config.authorize_url || '');
                setTokenUrl(config.token_url || '');
                setScope(config.scope || 'loans conditions');
                setApiBaseUrl(config.api_base_url || 'https://api.lendingpad.com');
                setLoansListPath(config.loans_list_path || '/api/v1/loans');
                setLoanOfficerUserId(config.default_loan_officer_user_id || '');
                setIsEditing(true);
              }}>
                Update
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove LendingPad Integration</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the LendingPad credentials. Loan sync will stop until you reconnect.
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

        {/* Configuration form */}
        {(!hasSavedCredentials || isEditing) && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lp-client-id">Client ID <span className="text-destructive">*</span></Label>
                <Input
                  id="lp-client-id"
                  placeholder="e.g. abc123"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lp-client-secret">Client Secret <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="lp-client-secret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Secret key"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="font-mono text-sm pr-10"
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-authorize-url">Authorize URL</Label>
              <Input
                id="lp-authorize-url"
                placeholder="https://api.lendingpad.com/oauth/authorize"
                value={authorizeUrl}
                onChange={(e) => setAuthorizeUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-token-url">Token URL</Label>
              <Input
                id="lp-token-url"
                placeholder="https://api.lendingpad.com/oauth/token"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-scope">Scope</Label>
              <Input
                id="lp-scope"
                placeholder="loans conditions"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-api-base">API base URL (REST)</Label>
              <Input
                id="lp-api-base"
                placeholder="https://api.lendingpad.com"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">From your LendingPad API agreement (host only; no trailing slash).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-loans-path">Loans list path</Label>
              <Input
                id="lp-loans-path"
                placeholder="/api/v1/loans"
                value={loansListPath}
                onChange={(e) => setLoansListPath(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-officer">Default loan officer user ID</Label>
              <Input
                id="lp-officer"
                placeholder="UUID of auth user (required for sync)"
                value={loanOfficerUserId}
                onChange={(e) => setLoanOfficerUserId(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supabase <code className="rounded bg-muted px-1">auth.users.id</code> for the officer who should own imported loans. Optional env:{' '}
                <code className="rounded bg-muted px-1">LENDINGPAD_DEFAULT_LOAN_OFFICER_ID</code>.
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Your credentials are encrypted and stored securely. They will be used by edge functions for OAuth token exchange and loan sync. Get your API credentials from{' '}
                <a
                  href="https://www.lendingpad.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:underline"
                >
                  LendingPad
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={
                  !clientId.trim() ||
                  (!clientSecret.trim() && !integration?.api_key) ||
                  saveMutation.isPending
                }
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Configuration
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setClientId('');
                    setClientSecret('');
                    setShowSecret(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Test + OAuth */}
        {hasSavedCredentials && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Test configuration
              </Button>
              <Button
                size="sm"
                onClick={handleConnectLendingPad}
                disabled={oauthStarting || !hasOAuthPrereqs}
                title={
                  !hasOAuthPrereqs
                    ? 'Save Client ID, secret, authorize URL, and token URL first.'
                    : undefined
                }
              >
                {oauthStarting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                Connect with LendingPad
              </Button>
              {hasAccessToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectOAuth}
                  disabled={oauthDisconnecting}
                >
                  {oauthDisconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Clear OAuth tokens
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => losSyncMutation.mutate()}
                disabled={
                  losSyncMutation.isPending ||
                  !integration?.is_active ||
                  !hasAccessToken ||
                  !(config.default_loan_officer_user_id || '').trim()
                }
                title={
                  !(config.default_loan_officer_user_id || '').trim()
                    ? 'Set default loan officer user ID (and save) before syncing.'
                    : undefined
                }
              >
                {losSyncMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync loans now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Test configuration</strong> checks OAuth fields. <strong>Connect with LendingPad</strong> completes
              OAuth. <strong>Sync loans now</strong> calls your configured REST path (per LendingPad API agreement) and
              upserts into Control Tower loans. Redirect URL:{' '}
              <code className="rounded bg-muted px-1 break-all">{getLendingPadOAuthRedirectUri() || '(your origin)/admin/integrations/oauth/callback?provider=lendingpad'}</code>
            </p>
          </div>
        )}

        {/* Active features summary */}
        {integration?.is_active && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Enabled:</strong> Loan data sync, Conditions sync, Milestones sync, Webhook receiver. Branch Managers and Loan Officers will see synced data on the Loans page based on their role.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
