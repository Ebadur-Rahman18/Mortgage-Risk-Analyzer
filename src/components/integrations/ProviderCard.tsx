/**
 * Provider Card Component
 * Displays an integration provider with status and action button
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IntegrationProvider,
  OrganizationIntegration,
  getProviderIcon,
  getConnectionStatusIcon,
  getConnectionStatusLabel,
  getConnectionStatusVariant,
  getProviderActionLabel,
} from '@/lib/integration-utils';

interface ProviderCardProps {
  provider: IntegrationProvider;
  orgIntegration?: OrganizationIntegration;
  onClick?: () => void;
}

export function ProviderCard({ provider, orgIntegration, onClick }: ProviderCardProps) {
  const navigate = useNavigate();
  const Icon = getProviderIcon(provider.slug);
  const StatusIcon = orgIntegration
    ? getConnectionStatusIcon(orgIntegration.connection_status)
    : null;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/admin/integrations/${provider.slug}`);
    }
  };

  const statusVariant = orgIntegration
    ? getConnectionStatusVariant(orgIntegration.connection_status)
    : 'secondary';

  const statusLabel = orgIntegration
    ? getConnectionStatusLabel(orgIntegration.connection_status)
    : provider.is_coming_soon
      ? 'Coming Soon'
      : 'Not Configured';

  const actionLabel = getProviderActionLabel(provider, orgIntegration);

  return (
    <Card
      className={`
        border-2 transition-all duration-200 cursor-pointer
        ${provider.is_coming_soon ? 'opacity-60' : 'hover:border-primary/50 hover:shadow-md'}
      `}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Icon */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <Icon className="h-8 w-8" />
          </div>

          {/* Provider Name */}
          <div className="w-full">
            <div className="flex items-center justify-center gap-2">
              <p className="font-semibold">{provider.name}</p>
              {provider.is_beta && (
                <Badge variant="outline" className="text-xs">
                  Beta
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {provider.description}
            </p>
          </div>

          {/* Status Badge */}
          <Badge variant={statusVariant} className="gap-1">
            {StatusIcon && <StatusIcon className="h-3 w-3" />}
            {statusLabel}
          </Badge>

          {/* Service Count or Auth Type */}
          {orgIntegration?.connection_status === 'connected' ? (
            <p className="text-xs text-muted-foreground">
              {/* Service count will be added later */}
              Connected
            </p>
          ) : (
            <p className="text-xs text-muted-foreground capitalize">
              {provider.auth_type.replace('_', ' ')}
            </p>
          )}

          {/* Action Button */}
          <Button
            variant={orgIntegration?.connection_status === 'connected' ? 'outline' : 'default'}
            size="sm"
            className="w-full"
            disabled={provider.is_coming_soon}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
