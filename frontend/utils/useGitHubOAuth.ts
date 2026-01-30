"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { request } from "@/utils/request";
import { oauth_url_github_path } from "@/utils/routes";

interface UseGitHubOAuthOptions {
  onSuccess?: () => void;
  showSuccessToast?: boolean;
  invalidateQueries?: string[][];
}

export function useGitHubOAuth() {
  const queryClient = useQueryClient();

  const openOAuthPopup = useCallback(
    async (options?: UseGitHubOAuthOptions) => {
      const { onSuccess, showSuccessToast = false, invalidateQueries = [["currentUser"]] } = options ?? {};

      const response = await request({
        method: "GET",
        url: oauth_url_github_path(),
        accept: "json",
      });

      if (!response.ok) return;

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
          popup?.close();
          window.removeEventListener("message", handleMessage);

          if (showSuccessToast) {
            toast.success("GitHub successfully connected.");
          }

          for (const queryKey of invalidateQueries) {
            void queryClient.invalidateQueries({ queryKey });
          }

          onSuccess?.();
        }
      };

      window.addEventListener("message", handleMessage);

      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          window.removeEventListener("message", handleMessage);
        }
      }, 500);
    },
    [queryClient],
  );

  return { openOAuthPopup };
}
