import { useMutation } from "@tanstack/react-query";
import MutationButton from "@/components/MutationButton";
import Status from "@/components/Status";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { getOauthCode } from "@/utils/oauth";
export default function SlackIntegration() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  // Fetch integration status
  const [integration, { refetch }] = trpc.slack.get.useSuspenseQuery({ companyId: company.id });

  const connectSlack = trpc.slack.connect.useMutation();
  const disconnectSlack = trpc.slack.disconnect.useMutation({
    onSuccess: () => {
      void refetch();
      setTimeout(() => disconnectSlack.reset(), 2000);
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const authUrl = await utils.slack.getAuthUrl.fetch({ companyId: company.id });
      const { code, params } = await getOauthCode(authUrl);
      await connectSlack.mutateAsync({ companyId: company.id, code, state: assertDefined(params.get("state")) });
      void refetch();
    },
    onSuccess: () => setTimeout(() => connectMutation.reset(), 2000),
  });

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
          <MutationButton mutation={connectMutation} loadingText="Connecting...">
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
