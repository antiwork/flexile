import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_administrators_url } from "@/utils/routes";

export const administratorsRouter = createRouter({
  invite: companyProcedure.input(z.object({ email: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_administrators_url(ctx.company.externalId, { host: ctx.host }), {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });

    if (!response.ok) {
      const { error_message } = z.object({ error_message: z.string() }).parse(await response.json());
      throw new TRPCError({ code: "BAD_REQUEST", message: error_message });
    }
  }),
});
