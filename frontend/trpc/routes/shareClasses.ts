import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_share_classes_url } from "@/utils/routes";

const shareClassSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const shareClassesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_share_classes_url(ctx.company.externalId), {
      headers: ctx.headers,
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch share classes",
      });
    }

    return z.array(shareClassSchema).parse(await response.json());
  }),
});
