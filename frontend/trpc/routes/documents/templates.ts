import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import jwt from "jsonwebtoken";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType } from "@/db/enums";
import { documentTemplates, users } from "@/db/schema";
import env from "@/env";
import { companyProcedure, createRouter, type ProtectedContext, protectedProcedure } from "@/trpc";
import { assertDefined } from "@/utils/assert";
docuseal.configure({ key: env.DOCUSEAL_TOKEN });

export const createSubmission = (
  ctx: ProtectedContext,
  templateId: bigint,
  target: typeof users.$inferSelect,
  role: "Company Representative" | "Signer",
) =>
  docuseal.createSubmission({
    template_id: Number(templateId),
    send_email: false,
    submitters: [
      { email: ctx.user.email, role, external_id: ctx.user.id.toString() },
      {
        email: target.email,
        role: role === "Signer" ? "Company Representative" : "Signer",
        external_id: target.id.toString(),
      },
    ],
  });

export const templatesRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(DocumentTemplateType).optional(),
        signable: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.company && !ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await db.query.documentTemplates.findMany({
        where: and(
          or(
            ctx.company ? eq(documentTemplates.companyId, ctx.company.id) : undefined,
            isNull(documentTemplates.companyId),
          ),
          input.type != null ? eq(documentTemplates.type, input.type) : undefined,
          input.signable != null ? eq(documentTemplates.signable, input.signable) : undefined,
        ),
        orderBy: asc(documentTemplates.updatedAt),
      });

      return rows.map((template) => ({
        id: template.externalId,
        ...pick(template, ["name", "type", "docusealId", "updatedAt"]),
        generic: !template.companyId,
      }));
    }),
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

    const [template] = await db.query.documentTemplates.findMany({
      columns: { name: true, type: true, docusealId: true, companyId: true },
      where: and(
        eq(documentTemplates.externalId, input.id),
        or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
      ),
    });

    if (!template) throw new TRPCError({ code: "NOT_FOUND" });

    const token = jwt.sign(
      {
        user_email: env.DOCUSEAL_USER_EMAIL,
        integration_email: ctx.company.email,
        document_urls: [],
        folder_name: ctx.company.slug,
        template_id: Number(template.docusealId),
      },
      env.DOCUSEAL_TOKEN,
    );

    const requiredFields = [
      { name: "__companySignature", title: "Company signature", role: "Company Representative", type: "signature" },
      { name: "__signerSignature", title: "Signer signature", role: "Signer", type: "signature" },
    ];

    return { template, token, requiredFields };
  }),
  create: companyProcedure
    .input(createInsertSchema(documentTemplates).pick({ name: true, type: true }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

      const template = await docuseal.createTemplateFromPdf({ documents: [], name: input.name });
      const [row] = await db
        .insert(documentTemplates)
        .values({ ...input, companyId: ctx.company.id, docusealId: BigInt(template.id) })
        .returning();

      return assertDefined(row).externalId;
    }),
  update: companyProcedure
    .input(createUpdateSchema(documentTemplates).pick({ name: true, signable: true }).extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

      const [row] = await db
        .update(documentTemplates)
        .set(pick(input, "name", "signable"))
        .where(and(eq(documentTemplates.externalId, input.id), eq(documentTemplates.companyId, ctx.company.id)))
        .returning();

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    }),
});
