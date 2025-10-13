import Bugsnag from "@bugsnag/js";
import { defaultShouldDehydrateQuery, QueryCache, QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { redirect } from "next/navigation";
import { getSession } from "next-auth/react";
import superjson from "superjson";
import { ResponseError } from "@/utils/request";

if (process.env.BUGSNAG_API_KEY)
  Bugsnag.start({
    apiKey: process.env.BUGSNAG_API_KEY,
    releaseStage: process.env.VERCEL_ENV || "development",
  });

export function createClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error) =>
          !(error instanceof TRPCClientError && ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"].includes(error.message)) &&
          failureCount === 0,
        queryKeyHashFn: (queryKey) => superjson.stringify(queryKey),
      },
      dehydrate: {
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

function onError(error: unknown) {
  if (!(error instanceof ResponseError)) return;
  const { response } = error;
  if (!response) return;

  switch (response.status) {
    case 401: {
      void getSession().then((session) => {
        const impersonating = session?.user.actorToken;
        if (impersonating) redirect("/impersonate?actor_token=null");
      });
      break;
    }
  }
}
