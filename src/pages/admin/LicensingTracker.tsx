import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { useNmlsLicenses, useNmlsLicenseMutations } from "@/hooks/usePhase7Compliance";
import { toast } from "sonner";

export default function LicensingTracker() {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const { data: rows = [], isLoading } = useNmlsLicenses(applied || undefined);
  const { upsert, remove } = useNmlsLicenseMutations(applied || undefined);

  const [holderType, setHolderType] = useState("individual");
  const [holderName, setHolderName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [nmlsId, setNmlsId] = useState("");

  const expiringSoon = useMemo(() => {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 60);
    return rows.filter((r) => {
      if (!r.expiration_date) return false;
      const d = new Date(r.expiration_date);
      return d >= now && d <= horizon;
    });
  }, [rows]);

  const add = async () => {
    if (!holderName.trim() || !stateCode.trim() || !licenseNumber.trim()) {
      return toast.error("Holder name, state, and license number are required.");
    }
    try {
      await upsert.mutateAsync({
        holder_type: holderType,
        holder_name: holderName.trim(),
        state_code: stateCode.trim().toUpperCase(),
        license_number: licenseNumber.trim(),
        nmls_id: nmlsId.trim() || null,
        status: "active",
      });
      toast.success("License added.");
      setHolderName("");
      setStateCode("");
      setLicenseNumber("");
      setNmlsId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          NMLS & licensing tracker
        </h1>
        <p className="text-sm text-muted-foreground">
          Track individual, branch, and company licenses by state with renewal visibility.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add license</CardTitle>
          <CardDescription>Manual baseline tracker for compliance operations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Holder type</Label>
            <Select value={holderType} onValueChange={setHolderType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">individual</SelectItem>
                <SelectItem value="branch">branch</SelectItem>
                <SelectItem value="company">company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs">Holder name</Label>
            <Input className="h-9" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">State</Label>
            <Input className="h-9" value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="CA" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">License #</Label>
            <Input className="h-9" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">NMLS ID</Label>
            <Input className="h-9" value={nmlsId} onChange={(e) => setNmlsId(e.target.value)} />
          </div>
          <Button type="button" className="h-9" onClick={() => void add()} disabled={upsert.isPending}>
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Search by holder, state, license number, or NMLS ID.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="max-w-sm" />
          <Button variant="secondary" onClick={() => setApplied(search.trim())}>Apply</Button>
          <Button variant="ghost" onClick={() => { setSearch(""); setApplied(""); }}>Clear</Button>
          <Badge variant="outline">Expiring ≤60d: {expiringSoon.length}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No licenses found.</p>
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">Holder</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">State</th>
                    <th className="px-2 py-2">License</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Expiration</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">{r.holder_name}</td>
                      <td className="px-2 py-2">{r.holder_type}</td>
                      <td className="px-2 py-2">{r.state_code}</td>
                      <td className="px-2 py-2">{r.license_number}</td>
                      <td className="px-2 py-2">{r.status}</td>
                      <td className="px-2 py-2">{r.expiration_date ?? "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            const approved = window.confirm("Remove this license? This action cannot be undone.");
                            if (!approved) return;
                            void remove
                              .mutateAsync(r.id)
                              .then(() => toast.success("Removed"))
                              .catch((e) => toast.error(String(e)));
                          }}
                        >
                          Remove
                        </Button>
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
