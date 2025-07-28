"use client";
import { type QueryClient } from "@tanstack/react-query";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import superjson from "superjson";
import { useUserStore } from "@/global";
import { request } from "@/utils/request";
import { type AppRouter } from "./server";
import { createClient } from "./shared";

export const trpc = createTRPCReact<AppRouter>();

const GetUserData = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession(); // NextAuth
  const { user, login, logout } = useUserStore();

  // Only use OTP authentication
  const isAuthenticated = !!session?.user;
  const authId = session?.user?.email;

  const { data } = useQuery({
    queryKey: ["currentUser", authId, "otp"],
    queryFn: async (): Promise<unknown> => {
      if (isAuthenticated && session.user && "jwt" in session.user) {
        const response = await request({
          url: "/api/user-data",
          method: "POST",
          accept: "json",
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
          jsonData: { jwt: (session.user as any).jwt },
          assertOk: true,
        });
        return await response.json();
      }

      throw new Error("No authentication method available");
    },
    enabled: !!isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && data) login(data);
    else logout();
  }, [isAuthenticated, data, login, logout]);

  if (isAuthenticated == null || (isAuthenticated && !user)) return null;
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
        <GetUserData>{children}</GetUserData>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
export * from "@/db/enums";
