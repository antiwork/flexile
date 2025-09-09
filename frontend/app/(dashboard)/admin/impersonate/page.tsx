"use client";

import { Loader2, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImpersonationApiResponse {
  success?: boolean;
  error?: string;
  impersonation_jwt?: string;
  user?: {
    id: number;
    email: string;
    name: string;
    legal_name?: string;
    preferred_name?: string;
  };
}

export default function ImpersonatePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImpersonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data: ImpersonationApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to impersonate user");
      }

      if (!data.impersonation_jwt || !data.user) {
        throw new Error("Invalid response from server");
      }

      await update({
        ...session,
        impersonation: {
          jwt: data.impersonation_jwt,
          user: data.user,
          originalUser: session?.user,
        },
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopImpersonation = async () => {
    setIsLoading(true);
    try {
      await update({
        ...session,
        impersonation: undefined,
      });

      router.push("/");
    } catch (_err) {
      setError("Failed to stop impersonation");
    } finally {
      setIsLoading(false);
    }
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

  const isCurrentlyImpersonating = Boolean(session?.impersonation);

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
              : "Enter a user's email address to impersonate them for debugging purposes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCurrentlyImpersonating ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Impersonating:</strong> {session?.impersonation?.user?.email || "Unknown"}
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
            <form onSubmit={handleImpersonate} className="space-y-4">
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
