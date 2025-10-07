"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ImpersonationService } from "@/utils/impersonation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function ImpersonatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (!token) {
      setStatus("error");
      setError("No impersonation token provided");
      return;
    }

    const startImpersonation = async () => {
      try {
        const session = await ImpersonationService.startImpersonation(token);
        setUserInfo({
          name: session.impersonated_user.name,
          email: session.impersonated_user.email,
        });
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to start impersonation:", error);
        setError("Failed to start impersonation session. Please try again.");
      } finally {
        setError(error instanceof Error ? error.message : "Failed to start impersonation session");
      }
    };

    startImpersonation();
  }, [searchParams, router]);
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <h1 className="text-xl font-semibold">Starting impersonation session...</h1>
          <p className="text-muted-foreground">Please wait while we authenticate your request.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Impersonation Failed</strong>
              <br />
              {error}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => router.push("/")} 
            className="w-full"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Impersonation Started</strong>
            <br />
            You are now impersonating {userInfo?.name} ({userInfo?.email}).
            <br />
            Redirecting to dashboard...
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => router.push("/")} 
          className="w-full"
        >
          Go to Dashboard Now
        </Button>
      </div>
    </div>
  );
}
