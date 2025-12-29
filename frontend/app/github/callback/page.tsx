"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/utils/request";
import { callback_github_path } from "@/utils/routes";

function GitHubCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage(searchParams.get("error_description") ?? "GitHub authorization was denied.");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code or state parameter.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const response = await request({
          method: "POST",
          url: callback_github_path(),
          accept: "json",
          jsonData: { code, state },
        });

        if (!response.ok) {
          const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
          throw new Error(errorData.data?.error ?? "Failed to connect GitHub account");
        }

        setStatus("success");

        // Notify opener window and close if this was opened as a popup
        if (window.opener) {
          try {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- window.opener is not typed correctly
            (window.opener as Window).postMessage({ type: "github-oauth-success" }, window.location.origin);
          } catch {
            // Cross-origin access may fail, but that's ok
          }
          // Small delay before closing to ensure message is sent
          setTimeout(() => window.close(), 100);
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    void exchangeCode();
  }, [searchParams]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {status === "loading" && "Connecting GitHub..."}
          {status === "success" && "GitHub Connected!"}
          {status === "error" && "Connection Failed"}
        </CardTitle>
        <CardDescription>
          {status === "loading" && "Please wait while we connect your GitHub account."}
          {status === "success" &&
            "Your GitHub account has been connected. This window will close automatically, or you may close it manually."}
          {status === "error" && errorMessage}
        </CardDescription>
      </CardHeader>
      {(status === "error" || status === "success") && (
        <CardContent>
          <button onClick={() => window.close()} className="text-primary text-sm underline hover:no-underline">
            Close this window
          </button>
        </CardContent>
      )}
    </Card>
  );
}

function GitHubCallbackLoading() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connecting GitHub...</CardTitle>
        <CardDescription>Please wait while we connect your GitHub account.</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function GitHubCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<GitHubCallbackLoading />}>
        <GitHubCallbackContent />
      </Suspense>
    </div>
  );
}
