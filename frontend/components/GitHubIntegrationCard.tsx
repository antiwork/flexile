"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";
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
import { useGitHubOAuth } from "@/utils/useGitHubOAuth";

interface GitHubIntegrationCardProps {
  connectedIdentifier?: string | null;
  description: string;
  disconnectEndpoint: string;
  disconnectModalTitle: string;
  disconnectModalDescription: string;
  disconnectButtonText?: string;
  onConnect?: () => void | Promise<void>;
  isConnecting?: boolean;
  connectError?: string | null;
  onDisconnectSuccess?: () => void;
}

export function GitHubIntegrationCard({
  connectedIdentifier,
  description,
  disconnectEndpoint,
  disconnectModalTitle,
  disconnectModalDescription,
  disconnectButtonText = "Disconnect account",
  onConnect,
  isConnecting = false,
  connectError,
  onDisconnectSuccess,
}: GitHubIntegrationCardProps) {
  const queryClient = useQueryClient();
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { openOAuthPopup } = useGitHubOAuth();

  const handleConnect = onConnect ?? (() => void openOAuthPopup());

  const disconnectMutation = useMutation({
    mutationFn: async (): Promise<unknown> => {
      const response = await request({
        method: "DELETE",
        url: disconnectEndpoint,
        accept: "json",
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.success ? errorData.data.error : "Failed to disconnect GitHub");
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
                  <span className="size-2 rounded-full bg-green-700" />
                  {connectedIdentifier}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="hover:text-destructive focus:text-destructive justify-center"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsDisconnectModalOpen(true);
                  }}
                >
                  {disconnectButtonText}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void handleConnect()}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </CardHeader>
      </Card>

      {connectError ? <p className="text-destructive text-sm">{connectError}</p> : null}

      <AlertDialog open={isDisconnectModalOpen} onOpenChange={handleDisconnectModalOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{disconnectModalTitle}</AlertDialogTitle>
            <AlertDialogDescription>{disconnectModalDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
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
