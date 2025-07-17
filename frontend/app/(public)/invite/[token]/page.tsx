"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserStore } from "@/global";
import { INVITATION_TOKEN_COOKIE_MAX_AGE, INVITATION_TOKEN_COOKIE_NAME } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

export default function AcceptInvitationPage() {
  const { token } = useParams();
  const router = useRouter();

  const { user, pending } = useUserStore();
  const safeToken = typeof token === "string" ? token : "";
  const { data: inviteData, isLoading, isError } = trpc.companyInviteLinks.verify.useQuery({ token: safeToken });

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
      await switchCompany(inviteData?.company_id || "");
      router.push("/dashboard");
    },
  });

  const acceptInvite = () => {
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

  useEffect(() => {
    if (inviteData?.valid) {
      acceptInvite();
    }
  }, [inviteData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
        <div className="border-muted mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-black" />
        <div className="text-md font-semibold">Verifying invitation...</div>
      </div>
    );
  }

  if (isError || !inviteData?.valid) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-semibold">Invalid Invite Link.</div>
        <div className="text-md mb-4 text-center">Please check your invitation link or contact your administrator.</div>
        <Link href="/" className="rounded bg-black px-4 py-2 text-white transition hover:bg-gray-900">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
        <CheckCircleIcon className="mb-4 h-8 w-8 text-green-600" />
        <div className="text-md font-semibold">Verified</div>
      </div>

      {pending ? (
        <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
          <div className="border-muted mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-black" />
          <div className="text-md font-semibold">Accepting invitation...</div>
        </div>
      ) : null}
      {acceptInviteMutation.isError ? (
        <div className="mt-2 text-sm text-red-600">{acceptInviteMutation.error.message}</div>
      ) : null}
    </>
  );
}
