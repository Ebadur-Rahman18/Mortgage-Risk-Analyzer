/**
 * SSO Settings Page
 * Stubbed until SSO configuration tables are created
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Settings,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

const PROVIDER_CONFIGS = [
  {
    type: 'google_workspace',
    name: 'Google Workspace',
    description: 'Sign in with Google corporate accounts',
    icon: '🔵',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    type: 'azure_ad',
    name: 'Microsoft Azure AD',
    description: 'Sign in with Microsoft 365 accounts',
    icon: '🔷',
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
  },
  {
    type: 'saml',
    name: 'SAML 2.0',
    description: 'Enterprise SAML identity provider (requires Supabase Pro)',
    icon: '🔐',
    setupUrl: '',
  },
];

export default function SSOSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SSO Settings</h1>
        <p className="text-muted-foreground">
          Configure enterprise single sign-on providers
        </p>
      </div>

      {/* Migration Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Database Migration Required</AlertTitle>
        <AlertDescription>
          The sso_configurations and sso_domains tables need to be created. 
          SSO management will be available once the database migration is complete.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="providers">SSO Providers</TabsTrigger>
          <TabsTrigger value="settings">Auth Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              SSO providers allow your users to sign in with their corporate accounts.
              Each provider requires configuration in both Supabase and the identity provider's console.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_CONFIGS.map((provider) => (
              <Card key={provider.type}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{provider.icon}</span>
                      {provider.name}
                    </CardTitle>
                    <Badge variant="outline">Not Set Up</Badge>
                  </div>
                  <CardDescription>{provider.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="flex-1 w-full" disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                  {provider.setupUrl && (
                    <a
                      href={provider.setupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-primary hover:underline"
                    >
                      Open Provider Console
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Methods</CardTitle>
              <CardDescription>
                Control which authentication methods are available to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Authentication settings require database migration to be completed first.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
