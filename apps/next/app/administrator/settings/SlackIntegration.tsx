import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import MutationButton from "@/components/MutationButton";
import Status from "@/components/Status";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { getOauthCode, hasOauthCode } from "@/utils/oauth";

export default function SlackIntegration() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();

  // Fetch integration status
  const [integration, { refetch }] = trpc.slack.get.useSuspenseQuery({ companyId: company.id });

  const connectSlack = trpc.slack.connect.useMutation({
    onSuccess: () => {
      void refetch();
      // Clean the URL
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search.replace(/[?&]code=[^&]+/, "").replace(/[?&]state=[^&]+/, ""),
      );
      setTimeout(() => connectSlack.reset(), 2000);
    },
    onError: () => {
      // Clean the URL even on error
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search.replace(/[?&]code=[^&]+/, "").replace(/[?&]state=[^&]+/, ""),
      );
    },
  });

  const disconnectSlack = trpc.slack.disconnect.useMutation({
    onSuccess: () => {
      void refetch();
      setTimeout(() => disconnectSlack.reset(), 2000);
    },
  });

  const getAuthUrlMutation = trpc.slack.getAuthUrl.useMutation({
    onSuccess: (url: string) => {
      window.location.href = url; // Redirect user to Slack OAuth page
    },
  });

  // Effect to handle the OAuth callback
  useEffect(() => {
    if (hasOauthCode() && !connectSlack.isLoading && !connectSlack.isSuccess) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      if (code && state) {
        connectSlack.mutate({ companyId: company.id, code, state });
      } else {
        console.error("Missing code or state in OAuth callback");
        // Optionally show an error message to the user
        // Clean the URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname +
            window.location.search.replace(/[?&]code=[^&]+/, "").replace(/[?&]state=[^&]+/, ""),
        );
      }
    }
  }, [company.id, connectSlack]);

  return (
    <div className="flex justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="flex items-center text-xl font-bold">Slack</h2>
          {integration?.status === "active" ? (
            <Status variant="success">Connected</Status>
          ) : integration?.status === "out_of_sync" ? (
            <Status variant="critical">Needs reconnecting</Status>
          ) : null}
        </div>
        <p className="text-gray-400">Connect Slack to interact with Flexile via chat.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        {integration?.status === "active" || integration?.status === "out_of_sync" ? (
          <MutationButton
            mutation={disconnectSlack}
            param={{ companyId: company.id }}
            loadingText="Disconnecting..."
            idleVariant="outline"
            successText="Disconnected!"
          >
            Disconnect
          </MutationButton>
        ) : (
          <MutationButton
            mutation={getAuthUrlMutation}
            param={undefined}
            loadingText={connectSlack.isLoading ? "Connecting..." : "Redirecting..."}
            disabled={connectSlack.isLoading || getAuthUrlMutation.isLoading}
          >
            Connect
          </MutationButton>
        )}
        {/* Display connection errors */}
        {connectSlack.isError ? (
          <p className="text-sm text-red-600">Connection failed: {connectSlack.error.message}</p>
        ) : null}
      </div>
    </div>
  );
}
