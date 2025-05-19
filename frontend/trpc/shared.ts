import Bugsnag from "@bugsnag/js";
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import superjson from "superjson";

if (process.env.BUGSNAG_API_KEY)
  Bugsnag.start({
    apiKey: process.env.BUGSNAG_API_KEY,
    releaseStage: process.env.VERCEL_ENV || "development",
  });

export function createClient() {
  return new QueryClient({
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
