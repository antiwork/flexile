"use client";

import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { AlertTriangle, User } from "lucide-react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

export default function ImpersonatePage() {
  const { data: session } = useSession();
  const company = useCurrentCompany();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: canImpersonate } = trpc.impersonation.canImpersonate.useQuery({ companyId: company.id });
  const startImpersonation = trpc.impersonation.startImpersonation.useMutation({
    onSuccess: async (data) => {
      try {
        setIsLoading(true);
        const result = await signIn("impersonation", {
          targetEmail: data.targetEmail,
          adminToken: session?.user?.jwt,
          redirect: false,
        });

        if (result?.error) {
          setError(result.error);
        } else {
          window.location.href = "/invoices";
        }
      } catch (err) {
        setError("Failed to start impersonation session");
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  if (!canImpersonate?.allowed) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to impersonate users.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleImpersonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    startImpersonation.mutate({ companyId: company.id, targetEmail: email.trim() });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Impersonate User</h1>
          <p className="text-muted-foreground mt-2">
            Log in as another user for debugging and support purposes.
          </p>
        </div>

        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Warning</AlertTitle>
          <AlertDescription className="text-yellow-700">
            You will be logged in as the selected user and have access to all their data.
            Use this feature responsibly and only for legitimate support purposes.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Select User to Impersonate</CardTitle>
            <CardDescription>
              Enter the email address of the user you want to impersonate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImpersonate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">User Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  disabled={isLoading || startImpersonation.isPending}
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading || startImpersonation.isPending || !email.trim()}
                  className="flex-1"
                >
                  {isLoading || startImpersonation.isPending ? "Starting..." : "Start Impersonation"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-2">Impersonation Rules:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>You can only impersonate users in your current company</li>
            <li>You cannot impersonate other administrators</li>
            <li>You cannot impersonate yourself</li>
            <li>The impersonation session will last until you log out</li>
          </ul>
        </div>
      </div>
    </div>
  );
}