import { generateHelperAuth } from "@helperai/client/auth";
import env from "@/env";
import { createRouter, protectedProcedure } from "@/trpc";

export const supportRouter = createRouter({
  createHelperSession: protectedProcedure.query(({ ctx }) =>
    generateHelperAuth({
      email: ctx.user.email,
      hmacSecret: env.HELPER_HMAC_SECRET,
    }),
  ),
});
