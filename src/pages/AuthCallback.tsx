/**
 * OAuth Callback Handler
 * Handles redirects from OAuth providers (Google, Microsoft, etc.)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the OAuth callback from Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth callback error:", error);
          setStatus("error");
          setMessage(error.message || "Authentication failed");
          toast({
            title: "Authentication failed",
            description: error.message,
            variant: "destructive",
          });
          
          // Redirect to login after a delay
          setTimeout(() => {
            navigate("/login");
          }, 3000);
          return;
        }

        if (data.session) {
          // Successful authentication
          setStatus("success");
          setMessage("Sign in successful! Redirecting...");
          toast({
            title: "Welcome!",
            description: "You've successfully signed in.",
          });
          
          // Redirect to dashboard
          setTimeout(() => {
            navigate("/dashboard");
          }, 1000);
        } else {
          // No session found
          setStatus("error");
          setMessage("No session found. Redirecting to login...");
          setTimeout(() => {
            navigate("/login");
          }, 2000);
        }
      } catch (error: any) {
        console.error("Unexpected error in auth callback:", error);
        setStatus("error");
        setMessage(error.message || "An unexpected error occurred");
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner />
          <p className={`mt-4 text-center ${
            status === "error" ? "text-destructive" : "text-muted-foreground"
          }`}>
            {message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

