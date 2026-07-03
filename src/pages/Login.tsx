import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import logoUrl from "@/assets/mortgageai-logo.svg";

function routeForRole(role: string | undefined): string {
  if (role === "admin") return "/admin";
  // Manager (moderator) and Loan Officer share the same post-login experience.
  // The legacy "user" role is hidden from the product and also lands on /dashboard.
  return "/dashboard";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bootstrapOpen, setBootstrapOpen] = useState<boolean | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bootstrap-first-admin", {
          method: "GET",
        });
        if (!error) setBootstrapOpen(Boolean((data as { open?: boolean })?.open));
      } catch {
        // Non-fatal — login still works even if bootstrap check fails
      }
    })();
  }, []);

  const resolveRoleAndNavigate = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    let target = "/dashboard";
    if (uid) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();
      target = routeForRole(roleRow?.role as string | undefined);
    }
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      await resolveRoleAndNavigate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white px-5 py-3 shadow-sm border border-border">
            <img src={logoUrl} alt="MortgageAI" className="h-8 w-auto" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Control Tower
            </span>
          </div>
        </div>

        {bootstrapOpen === true && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">No admin account yet</p>
              <p className="text-muted-foreground">
                This workspace has no administrator.{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Set up the first admin account →
                </Link>
              </p>
            </div>
          </div>
        )}

        <Card className="shadow-premium">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Info banner */}
              <div className="rounded-lg bg-muted/60 px-4 py-2.5 text-center text-xs text-muted-foreground">
                New users are added by an administrator from the admin panel.
              </div>

              {/* Live demo button */}
              <a
                href="https://mortgagedemo.collabai.software/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                Try the live demo
              </a>

              {/* OR divider */}
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4 pt-2">
              <Button type="submit" className="h-10 w-full font-medium" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {bootstrapOpen === true ? (
                  <>
                    First time?{" "}
                    <Link to="/signup" className="font-medium text-primary hover:underline">
                      Create the admin account
                    </Link>
                  </>
                ) : (
                  "Need access? Contact your administrator."
                )}
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security.
        </p>
      </div>
    </div>
  );
}
