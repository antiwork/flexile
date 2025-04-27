"use client";
import { useAuth } from "@clerk/nextjs";
import { type QueryClient } from "@tanstack/react-query";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { parseISO } from "date-fns";
import { useEffect, useState } from "react";
import superjson from "superjson";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import { policies } from "@/trpc/access";
import { request } from "@/utils/request";
import { internal_current_user_data_path } from "@/utils/routes";
import { type AppRouter } from "./server";
import { createClient } from "./shared";

export const trpc = createTRPCReact<AppRouter>();

const GetUserData = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn, userId } = useAuth();
  const { user, login, logout } = useUserStore();
  const { data } = useQuery({
    queryKey: ["currentUser", userId],
    queryFn: async (): Promise<unknown> => {
      const response = await request({
        url: internal_current_user_data_path(),
        accept: "json",
        method: "GET",
        assertOk: true,
      });
      return await response.json();
    },
    enabled: !!isSignedIn,
  });
  useEffect(() => {
    if (isSignedIn && data) login(data);
    else logout();
  }, [isSignedIn, data]);
  if (isSignedIn == null || (isSignedIn && !user)) return null;
  return children;
};

// TODO improve this when we get the data from TRPC
export const useCanAccess = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  return (policy: keyof typeof policies) =>
    policies[policy]({
      company,
      user,
      companyAdministrator: !!user.roles.administrator,
      companyContractor: user.roles.worker
        ? {
            ...user.roles.worker,
            endedAt: user.roles.worker.endedAt ? parseISO(user.roles.worker.endedAt) : null,
          }
        : undefined,
      companyInvestor: !!user.roles.investor,
      companyLawyer: !!user.roles.lawyer,
    });
};

let queryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") {
    return createClient();
  }
  return (queryClient ??= createClient());
}
function getUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return "";
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3001";
  })();
  return `${base}/trpc`;
}
export function TRPCProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: getUrl(), transformer: superjson })],
    }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GetUserData>{children}</GetUserData>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
export * from "@/db/enums";
