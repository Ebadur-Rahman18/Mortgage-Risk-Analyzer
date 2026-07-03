import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useGmailOAuthCallback } from "@/hooks/useEmailIntelligence";
import { toast } from "sonner";

export default function EmailIntelligenceCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const mutation = useGmailOAuthCallback();
  const ran = useRef(false);

  useEffect(() => {
    if (oauthError) {
      toast.error(`Google OAuth: ${oauthError}`);
      navigate("/email-intelligence", { replace: true });
      return;
    }
    if (!code || ran.current) return;
    ran.current = true;

    const redirect_uri = `${window.location.origin}/email-intelligence/callback`;
    mutation.mutate(
      { code, redirect_uri },
      {
        onSuccess: () => {
          toast.success("Gmail connected");
          navigate("/email-intelligence", { replace: true });
        },
        onError: (e: Error) => {
          toast.error(e.message || "Failed to connect Gmail");
          navigate("/email-intelligence", { replace: true });
        },
      },
    );
  }, [code, oauthError, navigate, mutation]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Completing Gmail connection…</p>
    </div>
  );
}
