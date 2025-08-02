"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestAuthPage() {
  const { data: session, status } = useSession();

  const handleSignOut = () => {
    void signOut();
  };

  const handleSignIn = () => {
    void signIn("google");
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Test</CardTitle>
            <CardDescription>You are signed in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p>
                <strong>User ID:</strong> {session.user?.id}
              </p>
              <p>
                <strong>Email:</strong> {session.user?.email}
              </p>
              <p>
                <strong>Name:</strong> {session.user?.name}
              </p>
            </div>
            <Button onClick={handleSignOut} variant="outline">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
          <CardDescription>You are not signed in</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignIn} className="w-full">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
