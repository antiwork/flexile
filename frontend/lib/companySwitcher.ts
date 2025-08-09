"use client";

import { useUserStore } from "@/global";
import { getQueryClient } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

export const switchCompany = async (companyId: string) => {
  const queryClient = getQueryClient();

  useUserStore.setState((state) => ({ ...state, pending: true }));
  try {
    await request({
      method: "POST",
      url: company_switch_path(companyId),
      accept: "json",
    });
    await queryClient.resetQueries({ queryKey: ["currentUser"] });
  } finally {
    useUserStore.setState((state) => ({ ...state, pending: false }));
  }
};
