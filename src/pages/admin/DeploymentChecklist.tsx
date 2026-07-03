// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
/**
 * Deployment Checklist Dashboard
 * Tracks deployment readiness from live DB and integration data.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Rocket,
  Settings,
  Shield,
  Database,
  Plug,
  Users,
  Palette,
  FileCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { runClientHealthChecks } from '@/lib/admin-health-checks';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: 'required' | 'recommended' | 'optional';
  status: 'complete' | 'incomplete' | 'warning';
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  icon: React.ElementType;
}

interface ChecklistCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

async function fetchDeploymentChecklist(): Promise<ChecklistCategory[]> {
  const health = await runClientHealthChecks();

  const [
    openaiRes,
    sendgridRes,
    privilegedUsersRes,
    rolesCountRes,
    agentsCountRes,
    categoriesCountRes,
  ] = await Promise.all([
    supabase
      .from('integration_settings')
      .select('is_active,validation_status,api_key_masked')
      .eq('provider_name', 'openai')
      .maybeSingle(),
    supabase
      .from('integration_settings')
      .select('is_active')
      .eq('provider_name', 'sendgrid')
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'moderator']),
    supabase.from('roles').select('*', { count: 'exact', head: true }),
    supabase.from('ai_agents').select('*', { count: 'exact', head: true }),
    supabase.from('knowledge_categories').select('*', { count: 'exact', head: true }),
  ]);

  let environmentOverall: 'pass' | 'fail' | 'warning' | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('check-environment');
    if (!error && data && typeof data === 'object' && 'overallStatus' in data) {
      environmentOverall = (data as { overallStatus: 'pass' | 'fail' | 'warning' }).overallStatus;
    }
  } catch {
    environmentOverall = null;
  }

  const coreEnvOk =
    health.database.ok && health.auth.ok && health.storage.ok;
  const environmentComplete =
    environmentOverall === 'pass' ||
    (environmentOverall === null && coreEnvOk);

  const openai = openaiRes.data;
  const aiConfigured =
    !!openai?.is_active &&
    (openai.validation_status === 'valid' ||
      openai.validation_status === 'not_tested' ||
      openai.validation_status === undefined ||
      (!!openai.api_key_masked && openai.validation_status !== 'invalid'));

  const sendgrid = sendgridRes.data;
  const emailConfigured = !!sendgrid?.is_active;

  const adminCount = privilegedUsersRes.count ?? 0;
  const rolesSeeded = (rolesCountRes.count ?? 0) > 0;
  const templateDataOk =
    (agentsCountRes.count ?? 0) > 0 && (categoriesCountRes.count ?? 0) > 0;

  const categories: ChecklistCategory[] = [
    {
      id: 'core',
      title: 'Core Configuration',
      items: [
        {
          id: 'onboarding',
          title: 'Platform Setup',
          description: 'Complete the initial platform configuration wizard',
          category: 'required',
          status: 'incomplete',
          action: {
            label: 'Run Setup',
            href: '/admin/onboarding',
          },
          icon: Settings,
        },
        {
          id: 'branding',
          title: 'Branding Configured',
          description: 'Set platform name, colors, and logo in system settings',
          category: 'recommended',
          status: 'incomplete',
          action: {
            label: 'Configure',
            href: '/admin/settings',
          },
          icon: Palette,
        },
        {
          id: 'environment',
          title: 'Environment Validated',
          description:
            environmentOverall === null
              ? 'Database, auth, and storage checks from this session'
              : 'Edge function environment check last run',
          category: 'required',
          status: environmentComplete ? 'complete' : 'warning',
          action: environmentComplete
            ? undefined
            : {
                label: 'Validate',
                href: '/admin/environment',
              },
          icon: FileCheck,
        },
      ],
    },
    {
      id: 'security',
      title: 'Security & Access',
      items: [
        {
          id: 'admin-user',
          title: 'Admin User Created',
          description: 'At least one admin or moderator role assignment exists',
          category: 'required',
          status: adminCount > 0 ? 'complete' : 'incomplete',
          icon: Shield,
        },
        {
          id: 'roles',
          title: 'Roles Configured',
          description: 'Role definitions exist in the system',
          category: 'recommended',
          status: rolesSeeded ? 'complete' : 'incomplete',
          action: {
            label: 'Manage Roles',
            href: '/admin/roles',
          },
          icon: Users,
        },
      ],
    },
    {
      id: 'integrations',
      title: 'Integrations',
      items: [
        {
          id: 'ai-provider',
          title: 'AI Provider Connected',
          description: 'Configure OpenAI (or validated provider) for chat and embeddings',
          category: 'recommended',
          status: aiConfigured ? 'complete' : 'incomplete',
          action: {
            label: 'Configure AI',
            href: '/admin/integrations',
          },
          icon: Plug,
        },
        {
          id: 'email-provider',
          title: 'Email Provider (Optional)',
          description: 'Configure SendGrid for email notifications',
          category: 'optional',
          status: emailConfigured ? 'complete' : 'incomplete',
          action: {
            label: 'Configure',
            href: '/admin/integrations',
          },
          icon: Plug,
        },
      ],
    },
    {
      id: 'data',
      title: 'Data & Content',
      items: [
        {
          id: 'template-data',
          title: 'Template Data Seeded',
          description: 'At least one AI agent and one knowledge category exist',
          category: 'recommended',
          status: templateDataOk ? 'complete' : 'incomplete',
          action: {
            label: 'Seed Data',
            href: '/admin/settings',
          },
          icon: Database,
        },
        {
          id: 'storage-buckets',
          title: 'Storage Buckets',
          description: 'Storage API reachable and buckets list successfully',
          category: 'required',
          status: health.storage.ok ? 'complete' : 'warning',
          action: health.storage.ok
            ? undefined
            : {
                label: 'View Status',
                href: '/admin/environment',
              },
          icon: Database,
        },
      ],
    },
  ];

  return categories;
}

export default function DeploymentChecklist() {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: checklist, isLoading, refetch, isError, error } = useQuery({
    queryKey: ['deployment-checklist'],
    queryFn: fetchDeploymentChecklist,
    staleTime: 30000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const allItems = checklist?.flatMap((c) => c.items) || [];
  const requiredItems = allItems.filter((i) => i.category === 'required');
  const completedRequired = requiredItems.filter((i) => i.status === 'complete');
  const completedAll = allItems.filter((i) => i.status === 'complete');

  const requiredProgress =
    requiredItems.length > 0 ? (completedRequired.length / requiredItems.length) * 100 : 0;
  const totalProgress =
    allItems.length > 0 ? (completedAll.length / allItems.length) * 100 : 0;

  const isDeploymentReady = requiredProgress === 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'required':
        return <Badge variant="destructive">Required</Badge>;
      case 'recommended':
        return <Badge variant="default">Recommended</Badge>;
      default:
        return <Badge variant="secondary">Optional</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployment Checklist</h1>
          <p className="text-muted-foreground">
            Track deployment readiness and configuration status
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load checklist</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {/* Deployment Status */}
      <Card className={isDeploymentReady ? 'border-green-500' : 'border-yellow-500'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Deployment Status
              </CardTitle>
              <CardDescription>
                {isDeploymentReady
                  ? 'All required items complete. Ready to deploy!'
                  : 'Complete required items before deploying'}
              </CardDescription>
            </div>
            <Badge
              variant={isDeploymentReady ? 'default' : 'secondary'}
              className={isDeploymentReady ? 'bg-green-500' : ''}
            >
              {isDeploymentReady ? 'Ready' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Required Items</span>
              <span>
                {completedRequired.length} / {requiredItems.length}
              </span>
            </div>
            <Progress value={requiredProgress} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>All Items</span>
              <span>
                {completedAll.length} / {allItems.length}
              </span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Checklist Categories */}
      {checklist?.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle>{category.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      item.status === 'complete'
                        ? 'bg-green-500/5 border-green-500/20'
                        : item.status === 'warning'
                          ? 'bg-yellow-500/5 border-yellow-500/20'
                          : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{item.title}</p>
                          {getCategoryBadge(item.category)}
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    {item.action && item.status !== 'complete' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (item.action?.onClick) {
                            item.action.onClick();
                          } else if (item.action?.href) {
                            navigate(item.action.href);
                          }
                        }}
                      >
                        {item.action.label}
                        {item.action.href && <ExternalLink className="ml-2 h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Resources for setting up your deployment:</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/environment')}>
              Environment Validator
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/settings')}>
              System Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/integrations')}>
              Integrations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
