"use client";

import { Loader2, UserCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getImpersonatedUserEmail,
  isCurrentlyImpersonating as checkImpersonationStatus,
  startImpersonation,
  stopImpersonation,
} from "@/lib/impersonation";

export default function ImpersonatePage() {
  const { data: session, update } = useSession();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImpersonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await startImpersonation(email, session, update);

    if (result.success) {
      window.location.reload();
    } else {
      setError(result.error || "An error occurred");
    }

    setIsLoading(false);
  };

  const handleStopImpersonation = async () => {
    setIsLoading(true);

    const result = await stopImpersonation(session, update);

    if (result.success) {
      window.location.reload();
    } else {
      setError(result.error || "Failed to stop impersonation");
    }

    setIsLoading(false);
  };

  if (!session?.user) {
    return (
      <div className="container mx-auto max-w-md py-8">
        <Alert>
          <AlertDescription>Please log in to access this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isCurrentlyImpersonating = checkImpersonationStatus(session);

  return (
    <div className="container mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            User Impersonation
          </CardTitle>
          <CardDescription>
            {isCurrentlyImpersonating
              ? "You are currently impersonating a user. Click below to stop impersonation."
              : "Enter a user's email address to impersonate them."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCurrentlyImpersonating ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Impersonating:</strong> {getImpersonatedUserEmail(session)}
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => void handleStopImpersonation()}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Stop Impersonation
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleImpersonate(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">User Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start Impersonation
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
