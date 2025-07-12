// TODO Remove this TRCP once we have moved away from DocumentTemplates table

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@/db";
import { documents, documentTemplates } from "@/db/schema";
import { baseProcedure, companyProcedure, createRouter } from "@/trpc";
import {
  company_invite_links_url,
  reset_company_invite_links_url,
  accept_invite_links_url,
  verify_invite_links_url,
  complete_onboarding_company_invite_links_url,
} from "@/utils/routes";

import { DocumentTemplateType, PayRateType } from "@/db/enums";
import { and, eq, isNull, or } from "drizzle-orm";
import { createSubmission } from "@/trpc/routes/documents/templates";
import { assertDefined } from "@/utils/assert";

type VerifyInviteLinkResult = {
  valid: boolean;
  company_name?: string;
  company_id?: string;
  error?: string;
};

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
      const url = complete_onboarding_company_invite_links_url(ctx.company.externalId, { host: ctx.host });
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({
          started_at: input.startedAt,
          pay_rate_in_subunits: input.payRateInSubunits,
          pay_rate_type: input.payRateType,
          role: input.role,
        }),
        headers: { "Content-Type": "application/json", ...ctx.headers },
      });
      if (!response.ok) {
        const error = z.object({ error_message: z.string(), success: z.boolean() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: error.error_message });
      }

      const { document_id, template_id } = z
        .object({ document_id: z.number().nullable(), template_id: z.number().nullable() })
        .parse(await response.json());

      if (!document_id || !template_id) return { documentId: null };

      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.id, BigInt(template_id)),
          eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
        ),
      });

      const document = await db.query.documents.findFirst({
        where: eq(documents.id, BigInt(document_id)),
        with: { signatures: { with: { user: true } } },
      });

      if (!document || !template) throw new TRPCError({ code: "NOT_FOUND" });

      const inviter = assertDefined(document.signatures.find((s) => s.title === "Company Representative")?.user);
      const submission = await createSubmission(ctx, template.docusealId, inviter, "Signer");
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
