"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, redirect } from "next/navigation";

import { ShieldBanIcon, Building2Icon } from "lucide-react";

import { useUserStore } from "@/global";
import { MutationStatusButton } from "@/components/MutationButton";
import { INVITATION_TOKEN_COOKIE_MAX_AGE, INVITATION_TOKEN_COOKIE_NAME } from "@/models/constants";
import { trpc } from "@/trpc/client";

export default function AcceptInvitationPage() {
  const { token } = useParams();
  const searchParams = useSearchParams();
  const user = useUserStore((state) => state.user);

  const safeToken = typeof token === "string" ? token : "";
  const { data: inviteData, isLoading, isError } = trpc.companyInviteLinks.verify.useQuery({ token: safeToken });

  const acceptInviteLinkMutation = trpc.companyInviteLinks.accept.useMutation({
    onSuccess: async () => {
      redirect("/dashboard");
    },
  });

  const onAcceptInvitation = () => {
    document.cookie = `${INVITATION_TOKEN_COOKIE_NAME}=; path=/; max-age=0`;
    if (!user) {
      document.cookie = `${INVITATION_TOKEN_COOKIE_NAME}=${encodeURIComponent(safeToken)}; path=/; max-age=${INVITATION_TOKEN_COOKIE_MAX_AGE}`;
      redirect(`/signup`);
    }

    if (user.companies.find((company) => company.id === inviteData?.company_id)) {
      redirect(`/dashboard`);
    }

    if (inviteData && inviteData.company_id) {
      acceptInviteLinkMutation.mutateAsync({ token: safeToken });
    }
  };

  useEffect(() => {
    if (searchParams?.get("accepted") === "true") {
      onAcceptInvitation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, inviteData, user]);

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
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
            <ShieldBanIcon className="h-8 w-8 text-red-500" />
          </div>
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
          <Building2Icon className="m-auto h-12 w-12 text-gray-700" />
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
