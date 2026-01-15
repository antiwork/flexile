"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useState } from "react";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
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
import { Card, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import githubMark from "@/images/github-mark.svg";
import { request } from "@/utils/request";
import { oauth_url_github_path } from "@/utils/routes";

interface GitHubIntegrationCardProps {
  connectedIdentifier?: string | null;
  description: string;
  disconnectEndpoint: string;
  disconnectModalTitle: string;
  disconnectModalDescription: string;
  onDisconnectSuccess?: () => void;
}

export function GitHubIntegrationCard({
  connectedIdentifier,
  description,
  disconnectEndpoint,
  disconnectModalTitle,
  disconnectModalDescription,
  onDisconnectSuccess,
}: GitHubIntegrationCardProps) {
  const queryClient = useQueryClient();
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "DELETE",
        url: disconnectEndpoint,
        accept: "json",
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.data?.error ?? "Failed to disconnect GitHub");
      }

      if (response.status === 204) {
        return null;
      }

      return response.json();
    },
    onSuccess: () => {
      setIsDisconnectModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      onDisconnectSuccess?.();
    },
  });

  const handleConnect = useCallback(async () => {
    const response = await request({
      method: "GET",
      url: oauth_url_github_path(),
      accept: "json",
    });

    if (!response.ok) {
      return;
    }

    const data = z.object({ url: z.string() }).parse(await response.json());

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    const handleMessage = (event: MessageEvent<unknown>) => {
      const messageData = event.data;
      if (
        typeof messageData === "object" &&
        messageData !== null &&
        "type" in messageData &&
        messageData.type === "github-oauth-success"
      ) {
        void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        popup?.close();
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", handleMessage);
      }
    }, 500);
  }, [queryClient]);

  const handleDisconnectModalOpenChange = (open: boolean) => {
    if (!open) {
      disconnectMutation.reset();
    }
    setIsDisconnectModalOpen(open);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Image src={githubMark} alt="GitHub" width={32} height={32} className="dark:invert" />
            <div className="flex flex-col">
              <span className="font-medium">GitHub</span>
              <span className="text-muted-foreground text-sm">{description}</span>
            </div>
          </div>
          {connectedIdentifier ? (
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full gap-2 sm:w-auto">
                  <span className="size-2 rounded-full bg-green-500" />
                  {connectedIdentifier}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="hover:text-destructive focus:text-destructive"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsDisconnectModalOpen(true);
                  }}
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => void handleConnect()}>
              Connect
            </Button>
          )}
        </CardHeader>
      </Card>

      <AlertDialog open={isDisconnectModalOpen} onOpenChange={handleDisconnectModalOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{disconnectModalTitle}</AlertDialogTitle>
            <AlertDialogDescription>{disconnectModalDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationStatusButton
                idleVariant="critical"
                mutation={disconnectMutation}
                onClick={(e) => {
                  e.preventDefault();
                  disconnectMutation.mutate();
                }}
                loadingText="Disconnecting..."
              >
                Disconnect
              </MutationStatusButton>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
