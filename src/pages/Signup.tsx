import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Lock, ExternalLink } from "lucide-react";
import logoUrl from "@/assets/mortgageai-logo.svg";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bootstrap-first-admin", {
          method: "GET",
        });
        if (error) throw error;
        setOpen(Boolean((data as { open?: boolean })?.open));
      } catch {
        setOpen(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-first-admin", {
        method: "POST",
        body: { email, password, full_name: fullName },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error) throw new Error(result.error);
      await signIn(email, password);
      navigate("/admin", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account");
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

        <Card className="shadow-premium">
          {checking ? (
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : !open ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-xl font-semibold">Signup is closed</CardTitle>
                </div>
                <CardDescription>
                  This workspace already has an administrator. New accounts can only be created
                  by an admin invitation.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl font-bold">Create workspace admin</CardTitle>
                </div>
                <CardDescription>
                  You're the first user — this account will become the workspace administrator.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
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
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex-col space-y-4 pt-2">
                  <Button type="submit" className="h-10 w-full font-medium" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create admin account"
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                      Sign in
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
