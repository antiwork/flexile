"use client";
import { type QueryClient, skipToken } from "@tanstack/react-query";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import superjson from "superjson";
import { useUserStore } from "@/global";
import { request } from "@/utils/request";
import { internal_current_user_data_path } from "@/utils/routes";
import { type AppRouter } from "./server";
import { createClient } from "./shared";

export const trpc = createTRPCReact<AppRouter>();

export const UserDataProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();
  const { login, logout } = useUserStore();

  const isSignedIn = !!session?.user;
  const userId = session?.user.email;

  const { data, isLoading } = useQuery({
    queryKey: ["currentUser", userId],
    queryFn: isSignedIn
      ? async (): Promise<unknown> => {
          const response = await request({
            url: internal_current_user_data_path(),
            method: "GET",
            accept: "json",
            assertOk: true,
          });
          return await response.json();
        }
      : skipToken,
  });

  useEffect(() => {
    if (isSignedIn && data) {
      login(data);
    } else if (!isSignedIn) {
      logout();
    }
    // Don't call logout() while loading (when isSignedIn=true but data=undefined)
  }, [isSignedIn, data, login, logout]);

  // Wait for session to load first
  if (status === "loading") return null;

  // Wait for query to complete before rendering children
  if (isSignedIn && (isLoading || !data)) return null;
  return children;
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
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
export * from "@/db/enums";
