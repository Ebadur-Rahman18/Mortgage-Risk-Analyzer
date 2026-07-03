// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * SendGrid — transactional email (notifications, feedback alerts).
 * Matches OpenAIIntegrationCard layout: status badges, saved view, test, toggle, active summary.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Mail,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  useIntegrationSetting,
  useSaveIntegrationSetting,
  useValidateIntegrationKey,
  useDeleteIntegrationSetting,
  useToggleIntegrationStatus,
} from '@/hooks/useIntegrationSettings';
import { useToast } from '@/hooks/use-toast';
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

const PROVIDER = 'sendgrid' as const;

export default function SendGridIntegrationCard() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('Control Tower');
  const [adminEmails, setAdminEmails] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const { data: integration, isLoading } = useIntegrationSetting(PROVIDER);
  const saveMutation = useSaveIntegrationSetting();
  const validateMutation = useValidateIntegrationKey();
  const deleteMutation = useDeleteIntegrationSetting();
  const toggleMutation = useToggleIntegrationStatus();

  const config = (integration?.config ?? {}) as Record<string, unknown>;

  useEffect(() => {
    if (!integration) return;
    const c = (integration.config ?? {}) as Record<string, unknown>;
    if (typeof c.from_email === 'string') setFromEmail(c.from_email);
    if (typeof c.from_name === 'string') setFromName(c.from_name);
    if (Array.isArray(c.admin_emails)) {
      setAdminEmails((c.admin_emails as string[]).join(', '));
    }
  }, [integration?.id, integration?.updated_at]);

  const hasSavedCredentials = Boolean(
    integration?.api_key || integration?.api_key_masked,
  );

  const handleSave = async () => {
    const key = apiKey.trim() || integration?.api_key || '';
    if (!key.trim()) {
      toast({ title: 'API key required', description: 'Enter or keep a saved SendGrid API key.', variant: 'destructive' });
      return;
    }
    if (!fromEmail.trim()) {
      toast({ title: 'From email required', description: 'Set a verified sender address in SendGrid.', variant: 'destructive' });
      return;
    }
    await saveMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: key,
      config: {
        from_email: fromEmail.trim(),
        from_name: fromName.trim() || 'Control Tower',
        admin_emails: adminEmails
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    });
    setApiKey('');
    setIsEditing(false);
    setShowApiKey(false);
  };

  const handleValidate = async () => {
    await validateMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: apiKey || integration?.api_key || '',
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(PROVIDER);
    setApiKey('');
    setFromEmail('');
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
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/20">
              <Mail className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                SendGrid
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>Transactional email for notifications and feedback alerts.</CardDescription>
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
        {hasSavedCredentials && !isEditing && (
          <div className="space-y-2">
            <Label>Current API key</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={integration?.api_key_masked || '••••••••••••'}
                disabled
                className="max-w-md font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
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
                    <AlertDialogTitle>Remove SendGrid?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Stored API key and settings will be deleted. You can still use SENDGRID_API_KEY in Edge secrets.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">From</span>
              <span>
                {String(config.from_name || 'Control Tower')} &lt;{String(config.from_email || '—')}&gt;
              </span>
            </div>
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
          </div>
        )}

        {(!hasSavedCredentials || isEditing) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sg-key">API key</Label>
              <div className="relative max-w-md">
                <Input
                  id="sg-key"
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="off"
                  placeholder={integration?.api_key_masked ? 'Leave blank to keep saved key' : 'SG.xxx'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sg-from">From email</Label>
              <Input
                id="sg-from"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Must be verified in SendGrid (single sender or domain).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sg-name">From name</Label>
              <Input id="sg-name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sg-admins">Feedback alert emails (optional)</Label>
              <Input
                id="sg-admins"
                placeholder="ops@company.com, admin@company.com"
                value={adminEmails}
                onChange={(e) => setAdminEmails(e.target.value)}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Keys are stored in <code className="rounded bg-muted px-1">integration_settings</code>. Edge functions
                use <code className="rounded bg-muted px-1">SENDGRID_API_KEY</code> and{' '}
                <code className="rounded bg-muted px-1">SENDGRID_FROM_EMAIL</code> secrets when set; otherwise the saved
                key and from address below.{' '}
                <a
                  href="https://sendgrid.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  SendGrid
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSave}
                disabled={
                  saveMutation.isPending ||
                  (!apiKey.trim() && !(integration?.api_key || '').trim()) ||
                  !fromEmail.trim()
                }
              >
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
                    setShowApiKey(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {integration && hasSavedCredentials && (
          <div className="border-t pt-2">
            <Button variant="outline" size="sm" onClick={handleValidate} disabled={validateMutation.isPending}>
              {validateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
          </div>
        )}

        {integration?.is_active && hasSavedCredentials && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Active:</strong> Feedback notifications, borrower email delivery, and other SendGrid-backed
              notifications use this configuration when Edge secrets are not set.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
