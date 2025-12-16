"use client";

// import { useCurrentCompany, useCurrentUser } from "@/global";
import { ChevronDown } from "lucide-react";
import { LeaveWorkspaceSection } from "@/app/settings/page";
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

export default function AccountPage() {
  // const user = useCurrentUser();

  return (
    <div className="grid gap-8">
      <hgroup>
        <h1 className="mb-1 text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground text-base">Manage your linked accounts and workspace access.</p>
      </hgroup>
      <IntegrationsSection />
      <LeaveWorkspaceSection />
    </div>
  );
}

const IntegrationsSection = () => (
  // const user = useCurrentUser();

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
              Your account is linked for verifying pull requests and bounties.
            </span>
          </div>
        </div>
        {/* <Button variant="outline" className="w-full text-base sm:w-auto" onClick={() => {}}>
            Connect
          </Button> */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />
              <span>laugardie</span>
              <ChevronDown className="text-muted-foreground size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0" role="menu" align="end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Disconnect account</Button>
              </AlertDialogTrigger>

              <AlertDialogContent className="">
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
                    <Button variant="critical">Disconnect</Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PopoverContent>
        </Popover>
      </CardHeader>
    </Card>
  </div>
);
