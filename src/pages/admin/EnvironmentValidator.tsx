import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface EnvironmentCheck {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  critical: boolean;
}

interface EnvironmentResponse {
  overallStatus: "pass" | "fail" | "warning";
  checks: EnvironmentCheck[];
  criticalFailures: number;
  timestamp: string;
}

export default function EnvironmentValidator() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<EnvironmentResponse>({
    queryKey: ["environment-check"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-environment");

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pass":
        return <Badge className="bg-green-500">Pass</Badge>;
      case "fail":
        return <Badge variant="destructive">Fail</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500">Warning</Badge>;
      default:
        return null;
    }
  };

  const criticalChecks = data?.checks.filter((c) => c.critical) || [];
  const optionalChecks = data?.checks.filter((c) => !c.critical) || [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Environment Validator</h1>
          <p className="text-muted-foreground">
            Verify platform configuration and external service connectivity
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing || isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to run environment checks: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Overall Status</CardTitle>
                  <CardDescription>
                    Last checked: {new Date(data.timestamp).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(data.overallStatus)}
                  {getStatusBadge(data.overallStatus)}
                </div>
              </div>
            </CardHeader>
            {data.criticalFailures > 0 && (
              <CardContent>
                <Alert variant="destructive">
                  <AlertDescription>
                    {data.criticalFailures} critical {data.criticalFailures === 1 ? "check" : "checks"}{" "}
                    failed. Please resolve these issues before using the platform.
                  </AlertDescription>
                </Alert>
              </CardContent>
            )}
          </Card>

          {/* Critical Checks */}
          <Card>
            <CardHeader>
              <CardTitle>Critical Checks</CardTitle>
              <CardDescription>
                These checks must pass for the platform to function properly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalChecks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <p className="font-medium">{check.name}</p>
                        <p className="text-sm text-muted-foreground">{check.message}</p>
                      </div>
                    </div>
                    {getStatusBadge(check.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Optional Checks */}
          <Card>
            <CardHeader>
              <CardTitle>Optional Integrations</CardTitle>
              <CardDescription>
                These integrations enhance platform functionality but are not required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optionalChecks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <p className="font-medium">{check.name}</p>
                        <p className="text-sm text-muted-foreground">{check.message}</p>
                      </div>
                    </div>
                    {getStatusBadge(check.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                If you're experiencing issues with environment validation:
              </p>
              <ul className="list-inside list-disc space-y-1 ml-4">
                <li>Verify all required environment variables are set in your Supabase project</li>
                <li>Check that API keys are valid and have not expired</li>
                <li>Ensure storage buckets exist and have proper permissions</li>
                <li>Run migrations to ensure database schema is up to date</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
