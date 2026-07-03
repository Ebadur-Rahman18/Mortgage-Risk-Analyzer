import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Info, Link2 } from "lucide-react";
import { IntegrationsGrid } from "@/components/admin/data-feeds/IntegrationsGrid";

export default function DataFeeds() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Third-Party Integrations
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage external data providers for loan and borrower sync.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="shrink-0"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh All
        </Button>
      </div>

      {/* Info banner */}
      <Alert className="border-blue-200 bg-blue-50/60 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm">
          Connection credentials and API keys are encrypted at rest. Only
          administrators can manage external data provider connections.
        </AlertDescription>
      </Alert>

      <Separator />

      {/* Integration cards grid */}
      <IntegrationsGrid />
    </div>
  );
}
