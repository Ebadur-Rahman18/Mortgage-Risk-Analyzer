// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * Generic AI Provider Integration Card
 * Reusable card for configuring any AI provider API key.
 * Follows the same pattern as OpenAIIntegrationCard.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
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

export interface AIProviderCardConfig {
  /** provider_name stored in integration_settings (e.g. "anthropic") */
  providerSlug: string;
  displayName: string;
  description: string;
  /** Icon element rendered inside the coloured square */
  icon: React.ReactNode;
  /** Tailwind classes for the icon wrapper bg (light + dark) */
  iconBgClass: string;
  /** Tailwind classes for the icon color (light + dark) */
  iconColorClass: string;
  /** Input placeholder showing the expected key format */
  apiKeyPlaceholder: string;
  /** URL shown in the "get your key from …" hint */
  docsUrl: string;
  docsLabel: string;
  /** Short list of features shown when the provider is active */
  activeFeatures: string;
}

interface Props {
  config: AIProviderCardConfig;
}

export default function AIProviderIntegrationCard({ config }: Props) {
  const {
    providerSlug,
    displayName,
    description,
    icon,
    iconBgClass,
    iconColorClass,
    apiKeyPlaceholder,
    docsUrl,
    docsLabel,
    activeFeatures,
  } = config;

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: integration, isLoading } = useIntegrationSetting(providerSlug);
  const saveMutation = useSaveIntegrationSetting();
  const validateMutation = useValidateIntegrationKey();
  const deleteMutation = useDeleteIntegrationSetting();
  const toggleMutation = useToggleIntegrationStatus();

  const hasSavedCredentials = Boolean(integration?.api_key || integration?.api_key_masked);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await saveMutation.mutateAsync({ provider_name: providerSlug, api_key: apiKey });
    setApiKey('');
    setIsEditing(false);
    setShowApiKey(false);
  };

  const handleValidate = async () => {
    await validateMutation.mutateAsync({
      provider_name: providerSlug,
      api_key: apiKey || integration?.api_key || '',
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(providerSlug);
    setApiKey('');
    setIsEditing(false);
  };

  const handleToggleStatus = async () => {
    if (!integration) return;
    await toggleMutation.mutateAsync({
      provider_name: providerSlug,
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
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBgClass}`}>
              <span className={iconColorClass}>{icon}</span>
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {displayName}
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
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
        {/* Current API Key Display */}
        {hasSavedCredentials && !isEditing && (
          <div className="space-y-2">
            <Label>Current API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                value={integration?.api_key_masked || '••••••••••••'}
                disabled
                className="font-mono text-sm"
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
                    <AlertDialogTitle>Remove {displayName} Integration</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove the {displayName} API key? This will disable
                      all features powered by this provider.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

        {/* API Key Input Form */}
        {(!hasSavedCredentials || isEditing) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${providerSlug}-api-key`}>{displayName} API Key</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`${providerSlug}-api-key`}
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={apiKeyPlaceholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono text-sm pr-10"
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
              <p className="text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:underline"
                >
                  {docsLabel}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Your API key is encrypted and stored securely. It will only be used server-side.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!apiKey.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save API Key
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

        {/* Test Connection Button */}
        {integration && hasSavedCredentials && (
          <div className="pt-2 border-t">
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
              Test Connection
            </Button>
          </div>
        )}

        {/* Active Features */}
        {integration?.is_active && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Active Features:</strong> {activeFeatures}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
