/**
 * Provider Detail Page
 * Stubbed until integration tables are created
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Plug } from 'lucide-react';

export default function ProviderDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/admin/integrations')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Button>

      {/* Migration Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Database Migration Required</AlertTitle>
        <AlertDescription>
          The integration_providers, integration_fields, and organization_integrations tables need to be created. 
          Provider configuration will be available once the database migration is complete.
        </AlertDescription>
      </Alert>

      {/* Provider Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Plug className="h-6 w-6" />
            Provider: {slug}
          </CardTitle>
          <CardDescription>Configure this integration provider</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This provider cannot be configured until the required database tables are created.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
