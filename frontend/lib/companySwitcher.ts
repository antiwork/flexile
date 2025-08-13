"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useCurrentUser, useUserStore } from "@/global";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

export const useSwitchCompany = () => {
  const router = useRouter();
  const user = useCurrentUser();
  const queryClient = useQueryClient();

  const switchCompany = useCallback(
    async (companyId: string) => {
      useUserStore.setState((state) => ({ ...state, pending: true }));
      try {
        await request({
          method: "POST",
          url: company_switch_path(companyId),
          accept: "json",
        });
        await queryClient.resetQueries({ queryKey: ["currentUser", user.email] });
        router.refresh();
      } finally {
        useUserStore.setState((state) => ({ ...state, pending: false }));
      }
    },
    [user.email, queryClient, router],
  );

  return { switchCompany };
};
