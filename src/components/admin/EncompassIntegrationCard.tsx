// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Save, Loader2, CheckCircle2, XCircle, AlertCircle, Landmark } from 'lucide-react';
import {
  useIntegrationSetting,
  useSaveIntegrationSetting,
  useValidateIntegrationKey,
  useToggleIntegrationStatus,
} from '@/hooks/useIntegrationSettings';
import { useSyncDataFeed } from '@/hooks/useSyncDataFeed';

const PROVIDER = 'encompass';
const DEFAULT_TOKEN_URL = 'https://api.elliemae.com/oauth2/v1/token';
const DEFAULT_API_BASE_URL = 'https://api.elliemae.com';

export default function EncompassIntegrationCard() {
  const { data: integration, isLoading } = useIntegrationSetting(PROVIDER);
  const saveMutation = useSaveIntegrationSetting();
  const validateMutation = useValidateIntegrationKey();
  const toggleMutation = useToggleIntegrationStatus();
  const syncMutation = useSyncDataFeed('encompass');

  const savedBundle = useMemo(() => {
    try {
      return JSON.parse(integration?.api_key || '{}') as { password?: string; clientSecret?: string };
    } catch {
      return {};
    }
  }, [integration?.api_key]);

  const [username, setUsername] = useState('');
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tokenUrl, setTokenUrl] = useState(DEFAULT_TOKEN_URL);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [syncPath, setSyncPath] = useState('/encompass/v3/loans');
  const [showPassword, setShowPassword] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [defaultOfficerId, setDefaultOfficerId] = useState('');

  useEffect(() => {
    if (!integration) return;
    const cfg = (integration.config ?? {}) as Record<string, string>;
    setUsername(cfg.encompass_username || '');
    setClientId(cfg.encompass_client_id || '');
    setTokenUrl(cfg.encompass_token_url || DEFAULT_TOKEN_URL);
    setApiBaseUrl(cfg.base_url || DEFAULT_API_BASE_URL);
    setSyncPath(cfg.sync_path || '/encompass/v3/loans');
    setDefaultOfficerId(cfg.default_loan_officer_user_id || '');
    try {
      const bundle = JSON.parse(integration.api_key || '{}') as { password?: string; clientSecret?: string };
      if (bundle.password) setPassword(bundle.password);
      if (bundle.clientSecret) setClientSecret(bundle.clientSecret);
    } catch {
      // api_key not a JSON bundle — leave fields as-is
    }
  }, [integration]);

  const hasSaved = Boolean(integration?.api_key || integration?.api_key_masked);

  const handleSave = async () => {
    const nextPassword = password.trim() || savedBundle.password || '';
    const nextClientSecret = clientSecret.trim() || savedBundle.clientSecret || '';
    if (!username.trim() || !clientId.trim() || !nextPassword || !nextClientSecret) return;

    await saveMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: JSON.stringify({ password: nextPassword, clientSecret: nextClientSecret }),
      config: {
        ...((integration?.config ?? {}) as Record<string, string>),
        encompass_username: username.trim(),
        encompass_client_id: clientId.trim(),
        encompass_token_url: tokenUrl.trim() || DEFAULT_TOKEN_URL,
        base_url: apiBaseUrl.trim() || DEFAULT_API_BASE_URL,
        sync_path: syncPath.trim() || '/encompass/v3/loans',
        default_loan_officer_user_id: defaultOfficerId.trim(),
      },
    });

    setPasswordEditing(false);
    setClientSecretEditing(false);
  };

  const handleValidate = async () => {
    await validateMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key:
        (password.trim() || clientSecret.trim())
          ? JSON.stringify({
              password: password.trim() || savedBundle.password || '',
              clientSecret: clientSecret.trim() || savedBundle.clientSecret || '',
            })
          : integration?.api_key || '',
      encompass_username: username.trim() || undefined,
      encompass_client_id: clientId.trim() || undefined,
      encompass_token_url: tokenUrl.trim() || undefined,
    });
  };

  const toggleStatus = async () => {
    if (!integration) return;
    await toggleMutation.mutateAsync({ provider_name: PROVIDER, is_active: !integration.is_active });
  };

  const badge = () => {
    if (!hasSaved) return <Badge variant="outline">Not configured</Badge>;
    if (!integration?.is_active) return <Badge variant="secondary">Disabled</Badge>;
    if (integration.validation_status === 'valid') {
      return (
        <Badge className="bg-emerald-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Valid
        </Badge>
      );
    }
    if (integration.validation_status === 'invalid' || integration.validation_status === 'error') {
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Invalid
        </Badge>
      );
    }
    return <Badge variant="outline">Not tested</Badge>;
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
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/20">
              <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Encompass
                {badge()}
              </CardTitle>
              <CardDescription>OAuth password grant (Ellie Mae ICE Mortgage Technology)</CardDescription>
            </div>
          </div>
          {hasSaved && (
            <div className="flex items-center gap-2">
              <Switch checked={!!integration?.is_active} onCheckedChange={toggleStatus} disabled={toggleMutation.isPending} />
              <span className="text-xs text-muted-foreground">{integration?.is_active ? 'On' : 'Off'}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="enc-username">Username</Label>
          <Input id="enc-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@encompass:INSTANCE_ID" className="font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enc-password">Password</Label>
          <div className="relative">
            <Input id="enc-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="pr-10 font-mono text-sm" />
            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="enc-client-id">Client ID</Label>
            <Input id="enc-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="awdls1t" className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enc-client-secret">Client Secret</Label>
            <div className="relative">
              <Input id="enc-client-secret" type={showClientSecret ? 'text' : 'password'} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client secret" className="pr-10 font-mono text-sm" />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowClientSecret((v) => !v)}>
                {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enc-token-url">Token URL</Label>
          <Input id="enc-token-url" value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)} className="font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enc-api-base">API base URL</Label>
          <Input id="enc-api-base" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} className="font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enc-sync-path">Loans sync path</Label>
          <Input id="enc-sync-path" value={syncPath} onChange={(e) => setSyncPath(e.target.value)} className="font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enc-officer-id">Default loan officer user ID</Label>
          <Input
            id="enc-officer-id"
            value={defaultOfficerId}
            onChange={(e) => setDefaultOfficerId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            UUID of the Supabase auth user who will own loans synced from Encompass.
          </p>
        </div>

        {integration?.validation_error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{integration.validation_error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={
              saveMutation.isPending ||
              !username.trim() ||
              !clientId.trim() ||
              (!(password.trim() || savedBundle.password) || !(clientSecret.trim() || savedBundle.clientSecret))
            }
          >
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save configuration
          </Button>
          <Button variant="outline" onClick={handleValidate} disabled={validateMutation.isPending || !hasSaved}>
            {validateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Test configuration
          </Button>
          <Button
            variant="default"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !integration?.is_active || !hasSaved}
          >
            {syncMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Sync now
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses OAuth password grant: <code className="rounded bg-muted px-1">grant_type=password</code>. Secrets are stored in integration settings and used only server-side for token exchange and sync.
        </p>
      </CardContent>
    </Card>
  );
}
