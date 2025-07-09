"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/global";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

export const useCompanySwitcher = () => {
  const queryClient = useQueryClient();

  const switchCompany = async (companyId: string) => {
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

  return { switchCompany };
};
