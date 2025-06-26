"use client";

import { redirect, RedirectType, useParams } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useUserStore } from "@/global";
import { InvitationModal } from "./InvitationModal";
import { public_contractor_invite_link_url } from "@/utils/routes";
import { request } from "@/utils/request";

const inviteDataSchema = z.object({
  id: z.string(),
  uuid: z.string(),
  company: z.object({
    id: z.string(),
    name: z.string(),
    logo_url: z.string().optional(),
  }),
  user: z.object({
    id: z.string(),
    display_name: z.string(),
  }),
});

type InviteData = z.infer<typeof inviteDataSchema>;

export default function JoinPage() {
  const user = useUserStore((state) => state.user);
  const { uuid } = useParams<{ uuid: string }>();

  useEffect(() => {
    if (user) throw redirect("/dashboard", RedirectType.replace);
  }, [user]);

  const {
    data: inviteData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contractorInvite", uuid],
    queryFn: async (): Promise<InviteData> => {
      const response = await request({
        method: "GET",
        accept: "json",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        url: public_contractor_invite_link_url(uuid),
        assertOk: true,
      });

      return inviteDataSchema.parse(await response.json());
    },
    retry: false,
    enabled: !!uuid,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading invitation...</div>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">Invitation not found</h1>
          <p className="text-gray-600">This invitation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <InvitationModal
        companyName={inviteData.company.name}
        companyLogo={inviteData.company.logo_url || undefined}
        inviterName={inviteData.user.display_name}
        inviteUuid={uuid}
      />
    </div>
  );
}
