// TODO Remove this TRCP once we have moved away from DocumentTemplates table

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { PayRateType } from "@/db/enums";
import { companyContractors, documentSignatures } from "@/db/schema";
import { baseProcedure, companyProcedure, createRouter } from "@/trpc";
import { accept_invite_links_url, verify_invite_links_url } from "@/utils/routes";

type VerifyInviteLinkResult = {
  valid: boolean;
  company_name?: string;
  company_id?: string;
  error?: string;
};

export const companyInviteLinksRouter = createRouter({
  completeOnboarding: companyProcedure
    .input(
      z.object({
        startedAt: z.string(),
        payRateInSubunits: z.number(),
        payRateType: z.nativeEnum(PayRateType),
        role: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(companyContractors)
        .set({
          startedAt: new Date(input.startedAt),
          role: input.role,
          payRateInSubunits: input.payRateInSubunits,
          payRateType: input.payRateType,
        })
        .where(eq(companyContractors.id, ctx.companyContractor.id));

      const userSignedDocument = await db.query.documentSignatures.findFirst({
        where: eq(documentSignatures.userId, ctx.user.id),
      });

      if (!userSignedDocument) return { documentId: null };

      return { documentId: userSignedDocument.documentId };
    }),

  accept: baseProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    const response = await fetch(accept_invite_links_url({ host: ctx.host }), {
      method: "POST",
      body: JSON.stringify({ token: input.token }),
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });

    if (!response.ok) {
      const { error_message } = z.object({ error_message: z.string() }).parse(await response.json());
      throw new TRPCError({ code: "BAD_REQUEST", message: error_message });
    }
  }),

  verify: baseProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const url = verify_invite_links_url({ host: ctx.host });

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ token: input.token }),
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });

    if (!response.ok) {
      const invalidResult: VerifyInviteLinkResult = { valid: false };
      return invalidResult;
    }

    const parsedResult = z
      .object({
        valid: z.boolean(),
        company_name: z.string().optional(),
        company_id: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(await response.json());

    return parsedResult;
  }),
});
