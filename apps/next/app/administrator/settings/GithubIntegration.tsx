import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import MutationButton from "@/components/MutationButton";
import Status from "@/components/Status";
import { useCurrentCompany } from "@/global";
import githubLogo from "@/images/github.svg";
import { trpc } from "@/trpc/client";
import { getOauthCode } from "@/utils/oauth";

export default function GithubIntegration({ oauthUrl }: { oauthUrl: string }) {
  const company = useCurrentCompany();

  const [integration, { refetch }] = trpc.github.get.useSuspenseQuery({ companyId: company.id });

  const connectGithub = trpc.github.connect.useMutation();
  const disconnectGithub = trpc.github.disconnect.useMutation({
    onSuccess: () => {
      void refetch();
      setTimeout(() => disconnectGithub.reset(), 2000);
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { code } = await getOauthCode(oauthUrl);
      await connectGithub.mutateAsync({ companyId: company.id, code });
      await refetch();
    },
    onSuccess: () => setTimeout(() => connectMutation.reset(), 2000),
  });

  return (
    <div className="flex justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">
            <Image src={githubLogo.src} className="inline size-6" alt="" />
            &ensp;GitHub
          </h2>
          {integration?.status === "active" || integration?.status === "initialized" ? (
            <Status variant="success">Connected</Status>
          ) : integration?.status === "out_of_sync" ? (
            <Status variant="critical">Needs reconnecting</Status>
          ) : null}
        </div>
        <p className="text-gray-400">Unfurl GitHub pull request and issue URLs within your team updates.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        {integration ? (
          <MutationButton
            mutation={disconnectGithub}
            param={{ companyId: company.id }}
            loadingText="Disconnecting..."
            idleVariant="outline"
          >
            Disconnect
          </MutationButton>
        ) : (
          <MutationButton mutation={connectMutation} loadingText="Connecting...">
            Connect
          </MutationButton>
        )}
      </div>
    </div>
  );
}
