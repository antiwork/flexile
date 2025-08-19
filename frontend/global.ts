import { redirect, RedirectType, usePathname } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { type CurrentUser, currentUserSchema } from "@/models/user";
import { assertDefined } from "@/utils/assert";

export const useUserStore = create(
  combine(
    {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- temporary
      user: null as CurrentUser | null,
      pending: false,
    },
    (set) => ({
      login: (user: unknown) => set({ user: currentUserSchema.parse(user) }),
      logout: () => set({ user: null }),
      setRedirected: () =>
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, onboardingPath: null } };
        }),
    }),
  ),
);

export const useCurrentUser = () => {
  const pathname = usePathname();
  const { user, setRedirected } = useUserStore((state) => state);
  if (!user) {
    // Preserve full URL including query parameters
    const fullUrl = typeof window !== "undefined" ? pathname + window.location.search : pathname;
    throw redirect(`/login?${new URLSearchParams({ redirect_url: fullUrl })}`, RedirectType.replace);
  }
  if (user.onboardingPath && user.onboardingPath !== window.location.pathname)
    throw redirect(user.onboardingPath, RedirectType.replace);
  useEffect(setRedirected, []);
  return user;
};
export const useCurrentCompany = () => {
  const user = useCurrentUser();
  return assertDefined(user.companies.find((c) => c.id === user.currentCompanyId));
};
