import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  redeemPortalInvite,
  setPortalAccessToken,
  getPortalAccessToken,
} from "@/lib/borrowerPortalApi";
import { Loader2 } from "lucide-react";

export default function PortalRedeem() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get("token")?.trim() ?? "";

  const [loanNumber, setLoanNumber] = useState("");
  const [manualToken, setManualToken] = useState(tokenFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setManualToken(tokenFromUrl);
  }, [tokenFromUrl]);

  // Resume session or redeem ?token= from invite link (no extra click).
  useEffect(() => {
    const existing = getPortalAccessToken();
    if (existing) {
      navigate("/portal/dashboard", { replace: true });
      return;
    }
    if (!tokenFromUrl) return;

    let cancelled = false;
    setBusy(true);
    setError(null);
    redeemPortalInvite(tokenFromUrl)
      .then((res) => {
        if (cancelled) return;
        setPortalAccessToken(res.access_token);
        navigate("/portal/dashboard", { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not sign in");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl, navigate]);

  const handleManualRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = manualToken.trim();
    if (!t) {
      setError("Paste the link token from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await redeemPortalInvite(t, loanNumber.trim() || undefined);
      setPortalAccessToken(res.access_token);
      navigate("/portal/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          {tokenFromUrl && busy
            ? "Opening your secure link…"
            : "Use the secure link your lender sent you. If you were asked for your loan number, enter it below before continuing."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleManualRedeem} className="space-y-4">
          {tokenFromUrl ? null : (
            <div className="space-y-2">
              <Label htmlFor="token">Link token</Label>
              <Input
                id="token"
                value={manualToken}
                onChange={(ev) => setManualToken(ev.target.value)}
                placeholder="Paste token from your invite link"
                autoComplete="off"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="loan">Loan number (optional)</Label>
            <Input
              id="loan"
              value={loanNumber}
              onChange={(ev) => setLoanNumber(ev.target.value)}
              placeholder="e.g. 2024-001234"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
