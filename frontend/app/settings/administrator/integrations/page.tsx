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
import { useCurrentCompany, useCurrentUser } from "@/global";
import githubLogo from "@/images/github.svg";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import {
  callback_github_organization_connection_path,
  github_organization_connection_path,
  start_github_organization_connection_path,
} from "@/utils/routes";

export default function IntegrationsPage() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const { data: connection, isLoading } = trpc.github.getCompanyConnection.useQuery(
    { companyId: company.id },
    { enabled: !!user.roles.administrator },
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (!user.roles.administrator) {
      router.replace("/settings");
    }
  }, [user, router]);

  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    const state = searchParams.get("state");

    if (installationId && state && !hasShownToast.current) {
      hasShownToast.current = true;
      const handleCallback = async () => {
        try {
          await request({
            method: "GET",
            accept: "json",
            url: callback_github_organization_connection_path({ installation_id: installationId, state }),
            assertOk: true,
          });
          await utils.github.getCompanyConnection.invalidate();
          toast.success("GitHub organization successfully connected.");
          router.replace("/settings/administrator/integrations");
        } catch {
          toast.error("Failed to connect GitHub organization.");
          hasShownToast.current = false;
        }
      };
      void handleCallback();
    } else if (searchParams.get("github_org") === "success" && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.success("GitHub organization successfully connected.");
      router.replace("/settings/administrator/integrations");
    }
  }, [searchParams, utils, router]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await request({
        method: "POST",
        accept: "json",
        url: start_github_organization_connection_path({
          company_id: company.externalId,
          redirect_url: window.location.href,
        }),
        assertOk: true,
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const data = (await response.json()) as { url: string },
        { url } = data;
      window.location.href = url;
    } catch {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await request({
        method: "DELETE",
        accept: "json",
        url: github_organization_connection_path(),
        assertOk: true,
      });
      await utils.github.getCompanyConnection.invalidate();
      toast.info("GitHub organization disconnected.");
    } catch {
      toast.error("Failed to disconnect GitHub organization.");
    }
  };

  return (
    <div className="grid gap-8">
      <hgroup>
        <h1 className="mb-1 text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-base">Connect Flexile to your company's favorite tools.</p>
      </hgroup>

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
                Automatically verify contractor pull requests and bounty claims.
              </span>
            </div>
          </div>

          {isLoading ? (
            <Loader2 className="text-muted-foreground animate-spin" />
          ) : connection ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>{connection.githubOrgLogin}</span>
                  <ChevronDown className="text-muted-foreground size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" role="menu" align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full justify-start rounded-none">
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader className="mb-4">
                      <AlertDialogTitle>Disconnect GitHub organization?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground mt-2 text-base">
                        This will prevent contractors from verifying Pull Request ownership and disable automatic bounty
                        checks.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <Button variant="outline">Cancel</Button>
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button variant="critical" onClick={() => void handleDisconnect()}>
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
              onClick={() => void handleConnect()}
            >
              {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect
            </Button>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
