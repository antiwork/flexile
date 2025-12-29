"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/utils/request";
import { callback_github_path } from "@/utils/routes";

export default function GitHubCallbackPage() {
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

        // Notify opener window and close
        const opener: unknown = window.opener;
        if (opener instanceof Window) {
          opener.postMessage({ type: "github-oauth-success" }, window.location.origin);
          window.close();
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    void exchangeCode();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {status === "loading" && "Connecting GitHub..."}
            {status === "success" && "GitHub Connected!"}
            {status === "error" && "Connection Failed"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we connect your GitHub account."}
            {status === "success" && "Your GitHub account has been connected. This window will close automatically."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        {status === "error" && (
          <CardContent>
            <button onClick={() => window.close()} className="text-primary text-sm underline hover:no-underline">
              Close this window
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
