"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { redirect, useParams } from "next/navigation";
import { INVITATION_TOKEN_COOKIE_MAX_AGE, INVITATION_TOKEN_COOKIE_NAME } from "@/models/constants";
import { request } from "@/utils/request";
import { accept_invite_links_path } from "@/utils/routes";

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { data: response } = useQuery({
    queryKey: ["accept_invite_link", token],
    queryFn: async () =>
      request({ url: accept_invite_links_path(), method: "POST", accept: "json", jsonData: { token } }),
    gcTime: 0,
  });

  if (!response) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
        <div className="border-muted mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-black" />
        <div className="text-md font-semibold">Verifying invitation...</div>
      </div>
    );
  }

  if (response.status === 401) {
    document.cookie = `${INVITATION_TOKEN_COOKIE_NAME}=${token}; path=/; max-age=${INVITATION_TOKEN_COOKIE_MAX_AGE}`;
    throw redirect(`/signup?${new URLSearchParams({ redirect_url: `/invite/${token}` })}`);
  }
  if (response.ok) throw redirect("/dashboard");

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
