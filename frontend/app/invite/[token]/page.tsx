"use client";

import { MutationStatusButton } from "@/components/MutationButton";
import { useUserStore } from "@/global";
import { trpc } from "@/trpc/client";
import { BuildingIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { useParams } from "next/navigation";

export default function AcceptInvitationPage() {
  const { token } = useParams();
  const user = useUserStore((state) => state.user);

  // Ensure token is always a string
  const safeToken = typeof token === "string" ? token : "";

  const { data: inviteData, isLoading, isError } = trpc.companyInviteLinks.verify.useQuery({ token: safeToken });

  const acceptInviteLinkMutation = trpc.companyInviteLinks.accept.useMutation({
    onSuccess: async () => {
      redirect("/dashboard");
    },
  });

  const onAcceptInvitation = () => {
    if (!user) {
      redirect(`/signup?invite_link_token=${encodeURIComponent(safeToken)}`);
    }
    if (inviteData && inviteData.company_id) {
      acceptInviteLinkMutation.mutateAsync({ companyId: inviteData.company_id, token: safeToken });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-muted flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
          <div className="border-muted mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-black" />
          <div className="text-md font-semibold">Verifying invitation...</div>
        </div>
      </div>
    );
  }

  if (isError || !inviteData?.valid) {
    return (
      <div className="bg-muted flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
          <div className="text-md mb-2 font-semibold text-red-600">Invalid or Expired Invite Link</div>
          <div className="text-muted-foreground text-sm">{"This invite link is no longer valid."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center">
      <div className="items-left flex w-full max-w-md flex-col rounded-xl bg-white p-8 shadow-lg">
        <div className="bg-muted mb-4 flex h-12 w-12 rounded-lg">
          <BuildingIcon className="m-auto h-12 w-12 text-gray-700" />
        </div>
        <div className="text-md mb-2 font-semibold">
          {inviteData.inviter_name || "Someone"} invited you to join {inviteData.company_name || "a company"}.
        </div>
        <div className="text-muted-foreground mb-6 text-sm">
          As a contractor, you’ll define your role, set your rate, and upload your contract. Let’s get started!
        </div>
        <form action={onAcceptInvitation}>
          <MutationStatusButton
            className="w-full rounded-lg bg-black py-3 text-base font-medium text-white transition hover:bg-gray-900"
            type="submit"
            mutation={acceptInviteLinkMutation}
            loadingText="Accepting..."
          >
            Accept Invitation
          </MutationStatusButton>
        </form>
        {acceptInviteLinkMutation.isError && (
          <div className="mt-2 text-sm text-red-600">{acceptInviteLinkMutation.error?.message}</div>
        )}
      </div>
    </div>
  );
}
