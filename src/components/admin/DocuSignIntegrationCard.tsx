// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
/**
 * DocuSign — electronic signature for borrower disclosures.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FileSignature, Save, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useIntegrationSetting,
  useSaveIntegrationSetting,
  useDeleteIntegrationSetting,
  useToggleIntegrationStatus,
} from "@/hooks/useIntegrationSettings";
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
} from "@/components/ui/alert-dialog";

const PROVIDER = "docusign" as const;

export default function DocuSignIntegrationCard() {
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://demo.docusign.net/restapi");

  const { data: integration, isLoading } = useIntegrationSetting(PROVIDER);
  const saveMutation = useSaveIntegrationSetting();
  const deleteMutation = useDeleteIntegrationSetting();
  const toggleMutation = useToggleIntegrationStatus();

  useEffect(() => {
    if (!integration?.config) return;
    const c = integration.config as Record<string, unknown>;
    if (typeof c.account_id === "string") setAccountId(c.account_id);
    if (typeof c.base_url === "string") setBaseUrl(c.base_url);
  }, [integration?.config]);

  const handleSave = async () => {
    const key = apiKey.trim() || integration?.api_key || "";
    if (!key.trim()) {
      toast.error("Integration Key (access token) is required");
      return;
    }
    if (!accountId.trim()) {
      toast.error("Account ID is required");
      return;
    }
    await saveMutation.mutateAsync({
      provider_name: PROVIDER,
      api_key: key,
      config: {
        account_id: accountId.trim(),
        base_url: baseUrl.trim() || "https://demo.docusign.net/restapi",
      },
    });
    setApiKey("");
  };

  const statusBadge = () => {
    if (!integration?.api_key) return <Badge variant="outline">Not configured</Badge>;
    if (!integration.is_active) return <Badge variant="secondary">Disabled</Badge>;
    return (
      <Badge className="bg-green-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            <div>
              <CardTitle>DocuSign</CardTitle>
              <CardDescription>
                Electronic signature for borrower disclosures. When enabled, borrowers must sign via
                DocuSign. When disabled, borrowers upload documents directly.
              </CardDescription>
            </div>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="ds-key">Integration Key (Access Token)</Label>
              <Input
                id="ds-key"
                type="password"
                autoComplete="off"
                placeholder={
                  integration?.api_key_masked ? "•••••••• (saved)" : "eyJ0eXAiOiJKV1Q..."
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                OAuth access token or JWT. Generated from the DocuSign Admin console.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-account">Account ID</Label>
              <Input
                id="ds-account"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-base">Base URL</Label>
              <Input
                id="ds-base"
                placeholder="https://demo.docusign.net/restapi"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use <code>demo.docusign.net</code> for sandbox or{" "}
                <code>na4.docusign.net</code> (etc.) for production.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              {integration && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={() =>
                      toggleMutation.mutate({
                        provider_name: PROVIDER,
                        is_active: !integration.is_active,
                      })
                    }
                  />
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove DocuSign?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The API key and configuration will be deleted. Existing disclosures will remain
                      in the database but no new signing requests can be sent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutateAsync(PROVIDER)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
