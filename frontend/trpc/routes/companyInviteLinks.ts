// TODO Remove this TRCP once we have moved away from DocumentTemplates table

import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType, DocumentType, PayRateType } from "@/db/enums";
import { companyContractors, companyInviteLinks, documents, documentSignatures, documentTemplates } from "@/db/schema";
import { baseProcedure, companyProcedure, createRouter } from "@/trpc";
import { createSubmission } from "@/trpc/routes/documents/templates";
import { assertDefined } from "@/utils/assert";
import {
  accept_invite_links_url,
  company_invite_links_url,
  reset_company_invite_links_url,
  verify_invite_links_url,
} from "@/utils/routes";

type VerifyInviteLinkResult = {
  valid: boolean;
  company_name?: string;
  company_id?: string;
  error?: string;
};

type DocumentTemplate = typeof documentTemplates.$inferSelect;

export const companyInviteLinksRouter = createRouter({
  get: companyProcedure.input(z.object({ documentTemplateId: z.string().nullable() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const params = new URLSearchParams();
    if (input.documentTemplateId && input.documentTemplateId.length > 0) {
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.externalId, input.documentTemplateId),
          or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
          eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
        ),
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document template not found" });
      }
      params.append("document_template_id", template.id.toString());
    }

    const url = company_invite_links_url(ctx.company.externalId, { host: ctx.host });
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: { ...ctx.headers },
    });
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to get invite link" });
    }
    const data = z.object({ invite_link: z.string(), success: z.boolean() }).parse(await response.json());
    return { invite_link: `${ctx.host}/invite/${data.invite_link}` };
  }),

  reset: companyProcedure
    .input(z.object({ documentTemplateId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const payload: { document_template_id?: string } = {};
      if (input.documentTemplateId && input.documentTemplateId.length > 0) {
        const template = await db.query.documentTemplates.findFirst({
          where: and(
            eq(documentTemplates.externalId, input.documentTemplateId),
            or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
            eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
          ),
        });
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document template not found" });
        }
        payload.document_template_id = template.id.toString();
      }

      const response = await fetch(reset_company_invite_links_url(ctx.company.externalId, { host: ctx.host }), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...ctx.headers },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to reset invite link" });
      }
      const data = z.object({ invite_link: z.string(), success: z.boolean() }).parse(await response.json());
      return { invite_link: `${ctx.host}/invite/${data.invite_link}` };
    }),

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

      let template: DocumentTemplate | undefined;
      if (!ctx.companyContractor.contractSignedElsewhere && ctx.user.signupInviteLinkId) {
        const inviteLink = await db.query.companyInviteLinks.findFirst({
          where: and(
            eq(companyInviteLinks.companyId, BigInt(ctx.company.id)),
            eq(companyInviteLinks.id, BigInt(ctx.user.signupInviteLinkId)),
            isNotNull(companyInviteLinks.documentTemplateId),
          ),
          columns: { documentTemplateId: true },
        });

        if (inviteLink?.documentTemplateId) {
          template = await db.query.documentTemplates.findFirst({
            where: and(
              eq(documentTemplates.id, BigInt(inviteLink.documentTemplateId)),
              eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
            ),
          });
        }
      }

      const userSignedDocument = await db.query.documentSignatures.findFirst({
        where: eq(documentSignatures.userId, ctx.user.id),
      });

      if (!template || !userSignedDocument) return { documentId: null };

      const document = await db.query.documents.findFirst({
        where: and(
          eq(documents.companyId, ctx.company.id),
          eq(documents.type, DocumentType.ConsultingContract),
          eq(documents.id, userSignedDocument.documentId),
        ),
        with: { signatures: { with: { user: true } } },
      });

      if (!document) return { documentId: null };

      const inviter = assertDefined(document.signatures.find((s) => s.title === "Company Representative")?.user);
      const submission = await createSubmission(ctx, template.docusealId, inviter, "Company Representative");
      await db.update(documents).set({ docusealSubmissionId: submission.id }).where(eq(documents.id, document.id));
      return { documentId: document.id };
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
