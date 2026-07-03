/**
 * Onboarding Wizard - New Client Setup
 * Stubbed until app_config table is created
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Palette,
  Settings,
  Sparkles,
  Rocket,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'organization', title: 'Organization Details', description: 'Configure your organization name and basic settings', icon: Building2 },
  { id: 'branding', title: 'Branding', description: 'Customize your platform appearance', icon: Palette },
  { id: 'features', title: 'Features', description: 'Enable or disable platform features', icon: Settings },
  { id: 'data', title: 'Seed Data', description: 'Set up initial templates and categories', icon: Sparkles },
  { id: 'complete', title: 'Complete', description: 'Review and finish setup', icon: Rocket },
];

interface OnboardingData {
  organizationName: string;
  adminEmail: string;
  platformName: string;
  primaryColor: string;
  logoUrl: string;
  enableAIChat: boolean;
  enableKnowledgeBase: boolean;
  enableMeetings: boolean;
  enableTasks: boolean;
  enableAIAgents: boolean;
  seedAIAgents: boolean;
  seedKnowledgeCategories: boolean;
  seedSampleData: boolean;
}

const defaultData: OnboardingData = {
  organizationName: '',
  adminEmail: '',
  platformName: 'Control Tower',
  primaryColor: '#3b82f6',
  logoUrl: '',
  enableAIChat: true,
  enableKnowledgeBase: true,
  enableMeetings: true,
  enableTasks: true,
  enableAIAgents: true,
  seedAIAgents: true,
  seedKnowledgeCategories: true,
  seedSampleData: false,
};

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const goNext = () => {
    const currentStepId = WIZARD_STEPS[currentStep].id;
    if (!completedSteps.includes(currentStepId)) {
      setCompletedSteps((prev) => [...prev, currentStepId]);
    }

    if (currentStep === WIZARD_STEPS.length - 2) {
      // Show migration notice on complete
      toast.info('Database migration required to save settings');
    }

    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const canProceed = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'organization':
        return data.organizationName.trim().length > 0;
      case 'branding':
        return data.platformName.trim().length > 0;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'organization':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name *</Label>
              <Input
                id="orgName"
                placeholder="e.g., Acme Corporation"
                value={data.organizationName}
                onChange={(e) => updateData({ organizationName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@yourcompany.com"
                value={data.adminEmail}
                onChange={(e) => updateData({ adminEmail: e.target.value })}
              />
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platformName">Platform Name *</Label>
              <Input
                id="platformName"
                placeholder="e.g., Control Tower"
                value={data.platformName}
                onChange={(e) => updateData({ platformName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={data.primaryColor}
                  onChange={(e) => updateData({ primaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={data.primaryColor}
                  onChange={(e) => updateData({ primaryColor: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-4">
            {[
              { key: 'enableAIChat', label: 'AI Chat Assistant' },
              { key: 'enableKnowledgeBase', label: 'Knowledge Base' },
              { key: 'enableMeetings', label: 'Meetings' },
              { key: 'enableTasks', label: 'Task Management' },
              { key: 'enableAIAgents', label: 'AI Agents' },
            ].map((feature) => (
              <div key={feature.key} className="flex items-center justify-between p-4 border rounded-lg">
                <p className="font-medium">{feature.label}</p>
                <Switch
                  checked={data[feature.key as keyof OnboardingData] as boolean}
                  onCheckedChange={(checked) => updateData({ [feature.key]: checked })}
                />
              </div>
            ))}
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            {[
              { key: 'seedAIAgents', label: 'AI Agent Templates' },
              { key: 'seedKnowledgeCategories', label: 'Knowledge Categories' },
              { key: 'seedSampleData', label: 'Sample Data' },
            ].map((option) => (
              <div key={option.key} className="flex items-center justify-between p-4 border rounded-lg">
                <p className="font-medium">{option.label}</p>
                <Switch
                  checked={data[option.key as keyof OnboardingData] as boolean}
                  onCheckedChange={(checked) => updateData({ [option.key]: checked })}
                />
              </div>
            ))}
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6 text-center py-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Database Migration Required</AlertTitle>
              <AlertDescription>
                The app_config table needs to be created to save these settings.
                Configuration will be available once the migration is complete.
              </AlertDescription>
            </Alert>

            <div className="text-left bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Configuration Summary:</h4>
              <ul className="space-y-1 text-sm">
                <li>Organization: {data.organizationName}</li>
                <li>Platform Name: {data.platformName}</li>
                <li>Features: {[
                  data.enableAIChat && 'AI Chat',
                  data.enableKnowledgeBase && 'Knowledge Base',
                  data.enableMeetings && 'Meetings',
                  data.enableTasks && 'Tasks',
                  data.enableAIAgents && 'AI Agents',
                ].filter(Boolean).join(', ')}</li>
              </ul>
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/admin/system-settings')}>
                View Settings
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Setup</h1>
        <p className="text-muted-foreground">
          Configure your new deployment in a few simple steps
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(step.id);

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center gap-1 ${
                isActive ? 'text-primary' : isCompleted ? 'text-green-500' : 'text-muted-foreground'
              }`}
            >
              <div className={`p-2 rounded-full ${isActive ? 'bg-primary/10' : isCompleted ? 'bg-green-500/10' : 'bg-muted'}`}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className="text-xs hidden sm:block">{step.title}</span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
          <CardDescription>{WIZARD_STEPS[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {WIZARD_STEPS[currentStep].id !== 'complete' && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={goBack} disabled={currentStep === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={goNext} disabled={!canProceed()}>
            {currentStep === WIZARD_STEPS.length - 2 ? 'Complete Setup' : 'Next'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
