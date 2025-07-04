"use client";

import { useParams, useRouter } from "next/navigation";

import { Building2Icon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useUserStore } from "@/global";
import { MutationStatusButton } from "@/components/MutationButton";
import SimpleLayout from "@/components/layouts/Simple";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

import { INVITATION_TOKEN_COOKIE_MAX_AGE, INVITATION_TOKEN_COOKIE_NAME } from "@/models/constants";

export default function AcceptInvitationPage() {
  const { token } = useParams();
  const router = useRouter();

  const { user, pending } = useUserStore();
  const safeToken = typeof token === "string" ? token : "";
  const {
    data: inviteData,
    isLoading,
    isError,
  } = trpc.companyInviteLinks.verify.useQuery({
    token: safeToken,
  });

  const queryClient = useQueryClient();

  const switchCompany = async (companyId: string) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    await request({
      method: "POST",
      url: company_switch_path(companyId),
      accept: "json",
    });
    await queryClient.resetQueries({ queryKey: ["currentUser"] });
    useUserStore.setState((state) => ({ ...state, pending: false }));
  };

  const acceptInviteMutation = trpc.companyInviteLinks.accept.useMutation({
    onSuccess: async () => {
      document.cookie = `${INVITATION_TOKEN_COOKIE_NAME}=; path=/; max-age=0`;
      switchCompany(inviteData?.company_id || "");
      router.push("/dashboard");
    },
  });

  const handleAcceptClick = () => {
    if (!user) {
      document.cookie = `${INVITATION_TOKEN_COOKIE_NAME}=${safeToken}; path=/; max-age=${INVITATION_TOKEN_COOKIE_MAX_AGE}`;
      router.push("/signup");
      return;
    }

    if (user.companies.some((company) => company.id === inviteData?.company_id)) {
      router.push("/dashboard");
      return;
    }

    acceptInviteMutation.mutate({ token: safeToken });
  };

  if (isLoading) {
    return (
      <SimpleLayout>
        <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
          <div className="border-muted mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-black" />
          <div className="text-md font-semibold">Verifying invitation...</div>
        </div>
      </SimpleLayout>
    );
  }

  if (isError || !inviteData?.valid) {
    return (
      <SimpleLayout title="Invalid Invite" subtitle="This invite link is no longer valid.">
        <div className="flex flex-col items-center">
          <div className="mb-4 text-sm text-gray-600">
            Please check your invitation link or contact your administrator.
          </div>
          <a href="/" className="rounded bg-black px-4 py-2 text-white transition hover:bg-gray-900">
            Go to Home
          </a>
        </div>
      </SimpleLayout>
    );
  }

  return (
    <SimpleLayout>
      <div className="items-left flex flex-col rounded-lg bg-white p-8 shadow-lg">
        <div className="bg-muted mb-4 flex h-12 w-12 rounded-lg">
          <Building2Icon className="m-auto h-12 w-12 text-gray-700" />
        </div>
        <div className="mb-2 text-base font-semibold">
          {inviteData.inviter_name || "Someone"} invited you to join {inviteData.company_name || "a company"}.
        </div>
        <div className="mb-6 text-sm">
          As a contractor, you’ll define your role, set your rate, and upload your contract. Let’s get started!
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAcceptClick();
          }}
        >
          <MutationStatusButton
            className="w-full rounded-lg bg-black py-2 text-base text-white transition hover:bg-gray-900"
            type="submit"
            mutation={acceptInviteMutation}
            loadingText="Accepting..."
            disabled={pending}
          >
            Accept invitation
          </MutationStatusButton>
        </form>
        {pending ? (
          <div className="mt-4 flex items-center justify-center">
            <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
            <span className="text-sm text-gray-700">Switching company...</span>
          </div>
        ) : null}
        {acceptInviteMutation.isError ? (
          <div className="mt-2 text-sm text-red-600">{acceptInviteMutation.error.message}</div>
        ) : null}
      </div>
    </SimpleLayout>
  );
}
