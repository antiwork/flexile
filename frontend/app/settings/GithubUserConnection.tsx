"use client";

import { ChevronDown, GithubIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import MutationButton from "@/components/MutationButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";

export default function GithubUserConnection() {
  const user = useCurrentUser();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const utils = trpc.useUtils();
  const disconnectGithub = trpc.github.disconnectUser.useMutation({
    onSuccess: () => {
      void utils.users.me.invalidate();
      setShowDisconnectDialog(false);
    },
  });

  const isConnected = !!user.githubUsername;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GithubIcon className="size-5" />
          GitHub Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            {isConnected ? (
              <p className="text-muted-foreground text-sm">
                Your account is linked for verifying pull requests and bounties.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Link your GitHub account to verify ownership of your work.
              </p>
            )}
          </div>
          <div>
            {isConnected ? (
              <button
                onClick={() => setShowDisconnectDialog(true)}
                className="hover:bg-accent flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors"
              >
                <div className="size-2 rounded-full bg-green-500"></div>
                <span className="font-medium">{user.githubUsername}</span>
                <ChevronDown className="text-muted-foreground ml-1 size-4" />
              </button>
            ) : (
              <Button variant="outline" onClick={() => signIn("github")}>
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Github account?</AlertDialogTitle>
            <AlertDialogDescription>Disconnecting stops us from verifying your GitHub work.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationButton
                mutation={disconnectGithub}
                idleVariant="destructive"
                loadingText="Disconnecting..."
                successText="Disconnected!"
              >
                Disconnect
              </MutationButton>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
