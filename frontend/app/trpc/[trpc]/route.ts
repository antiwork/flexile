import Bugsnag from "@bugsnag/js";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "@/trpc";
import { appRouter } from "@/trpc/server";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error }) {
      if (!["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)) {
        // eslint-disable-next-line no-console
        if (process.env.VERCEL_ENV !== "production") console.error(error);
        Bugsnag.notify(error);
      }
    },
  });
export { handler as GET, handler as POST };
