"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import githubLogo from "@/images/github.svg";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { disconnect_github_connection_path, start_github_connection_path } from "@/utils/routes";

export default function AccountPage() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <h1 className="mb-1 text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground text-base">Manage your linked accounts and workspace access.</p>
      </hgroup>
      <IntegrationsSection />
    </div>
  );
}

const IntegrationsSection = () => {
  const { data: githubUsername, isLoading: githubLoading } = trpc.github.getUserConnection.useQuery();
  const utils = trpc.useUtils();
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (searchParams.get("github") === "success" && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.success("GitHub account successfully linked.");
      router.replace("/settings/account");
    }
  }, [searchParams, router]);

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    try {
      const response = await request({
        method: "POST",
        accept: "json",
        url: start_github_connection_path(),
        assertOk: true,
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const data = (await response.json()) as { url: string },
        { url } = data;
      window.location.href = url;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    await request({
      method: "DELETE",
      accept: "json",
      url: disconnect_github_connection_path(),
      assertOk: true,
    });
    await utils.github.getUserConnection.invalidate();
    toast.info("GitHub account disconnected.");
  };

  return (
    <div className="grid gap-4">
      <h2 className="font-bold">Integrations</h2>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="border-muted size-8 rounded-md border-2 bg-white">
              <AvatarImage src={githubLogo.src} alt="Github logo" />
              <AvatarFallback className="rounded-none">G</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold">GitHub</span>
              <span className="text-muted-foreground text-sm">
                {githubUsername
                  ? "Your account is linked for verifying pull requests and bounties."
                  : "Link your GitHub account to verify ownership of your work."}
              </span>
            </div>
          </div>

          {githubLoading ? (
            <Loader2 className="text-muted-foreground animate-spin" />
          ) : githubUsername ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>{githubUsername}</span>
                  <ChevronDown className="text-muted-foreground size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" role="menu" align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full justify-start rounded-none">
                      Disconnect account
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader className="mb-4">
                      <AlertDialogTitle>Disconnect Github account?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground mt-2 text-base">
                        Disconnecting stops us from verifying your GitHub work.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <Button variant="outline">Cancel</Button>
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button variant="critical" onClick={() => void handleDisconnectGitHub()}>
                          Disconnect
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              variant="outline"
              className="w-full text-base sm:w-auto"
              disabled={isConnecting}
              onClick={() => void handleConnectGitHub()}
            >
              {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect
            </Button>
          )}
        </CardHeader>
      </Card>
    </div>
  );
};
