"use client";

import { GithubIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import MutationButton from "@/components/MutationButton";
import Status from "@/components/Status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";

export default function GithubUserConnection() {
  const user = useCurrentUser();
  const utils = trpc.useUtils();
  const disconnectGithub = trpc.github.disconnectUser.useMutation({
    onSuccess: () => {
      void utils.users.me.invalidate();
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
              <div className="flex items-center gap-2">
                <span className="font-medium">@{user.githubUsername}</span>
                <Status variant="success">Connected</Status>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Connect your GitHub account to link Pull Requests to your invoices.
              </p>
            )}
          </div>
          <div>
            {isConnected ? (
              <MutationButton
                mutation={disconnectGithub}
                idleVariant="outline"
                loadingText="Disconnecting..."
                successText="Disconnected!"
              >
                Disconnect
              </MutationButton>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-none"
              >
                Connect GitHub
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
