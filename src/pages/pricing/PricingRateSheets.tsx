import { useState } from "react";
import { useRateSheets } from "@/hooks/usePricing";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PricingRateSheets() {
  const { data: rateSheets, isLoading, refetch } = useRateSheets();
  const [csvText, setCsvText] = useState("");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!name || !csvText) {
      toast.error("Name and CSV content are required");
      return;
    }
    setUploading(true);
    try {
      const { data, error } = await (supabase.functions as any).invoke("pricing-rate-sheets-upload", {
        body: {
          name,
          csv_text: csvText,
        },
      });
      if (error) throw error;
      toast.success(`Uploaded rate sheet with ${data?.products_inserted ?? 0} rows`);
      setName("");
      setCsvText("");
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload rate sheet");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rate Sheets</h1>
        <p className="text-sm text-muted-foreground">
          Manage pricing rate sheets used by the Pricing &amp; Rate Lock module.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV Rate Sheet</CardTitle>
          <CardDescription>
            Paste CSV content with columns like Product, Loan Type, Rate, Price, Min FICO, Max LTV, State.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Rate sheet name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Paste CSV content here"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Rate Sheets</CardTitle>
          <CardDescription>Latest uploaded and imported rate sheets.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !rateSheets || rateSheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rate sheets found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Effective</th>
                    <th className="px-3 py-2">Expiration</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rateSheets.map((sheet) => (
                    <tr key={sheet.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{sheet.name}</td>
                      <td className="px-3 py-2 text-xs">
                        {sheet.effective_date || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {sheet.expiration_date || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs capitalize">
                        {sheet.status}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {sheet.source_type === "datastore" ? "Datastore" : "Upload"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

