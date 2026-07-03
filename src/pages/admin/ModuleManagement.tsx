import { useModuleSettings, useUpdateModuleSetting, type ModuleSetting } from "@/hooks/useModuleSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Layers } from "lucide-react";

export default function ModuleManagement() {
  const { data: modules = [], isLoading } = useModuleSettings();
  const updateModule = useUpdateModuleSetting();

  const handleToggle = (module: ModuleSetting) => {
    updateModule.mutate({ id: module.id, enabled: !module.enabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Management</h1>
        <p className="text-muted-foreground">
          Enable or disable modules for the entire application. When disabled, the module&apos;s UI and data are hidden from all users.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Card key={module.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{module.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`module-${module.id}`} className="text-sm font-normal text-muted-foreground">
                    {module.enabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id={`module-${module.id}`}
                    checked={module.enabled}
                    onCheckedChange={() => handleToggle(module)}
                    disabled={updateModule.isPending}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {module.description && (
                  <CardDescription>{module.description}</CardDescription>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && modules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p>No modules configured. Run the module_settings migration to seed the Loans module.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
