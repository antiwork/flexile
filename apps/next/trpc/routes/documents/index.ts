import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull, not, type SQLWrapper } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db, pagination, paginationSchema } from "@/db";
import { DocumentType } from "@/db/enums";
import { activeStorageAttachments, activeStorageBlobs, boardConsents, documents, users } from "@/db/schema";
import env from "@/env";
import { inngest } from "@/inngest/client";
import { companyProcedure, createRouter, getS3Url } from "@/trpc";
import { simpleUser } from "@/trpc/routes/users";
import { assertDefined } from "@/utils/assert";
import { templatesRouter } from "./templates";

docuseal.configure({ key: env.DOCUSEAL_TOKEN });

const visibleDocuments = (companyId: bigint, userId: bigint | SQLWrapper | undefined) =>
  and(
    eq(documents.companyId, companyId),
    isNull(documents.deletedAt),
    userId ? eq(documents.userId, userId) : undefined,
  );
export const documentsRouter = createRouter({
  list: companyProcedure
    .input(
      paginationSchema.and(
        z.object({ userId: z.string().nullable(), year: z.number().optional(), signable: z.boolean().optional() }),
      ),
    )
    .query(async ({ ctx, input }) => {
      if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
        throw new TRPCError({ code: "FORBIDDEN" });

      const signable = assertDefined(and(isNull(documents.completedAt), isNotNull(documents.docusealSubmissionId)));
      const where = and(
        visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined),
        input.year ? eq(documents.year, input.year) : undefined,
        input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
      );
      const rows = await db.query.documents.findMany({
        with: {
          user: { columns: simpleUser.columns },
          boardConsents: { columns: { lawyerApprovedAt: true } },
        },
        where,
        orderBy: [desc(documents.createdAt)],
        ...pagination(input),
      });
      const total = await db.$count(documents, where);
      const attachmentRows = await db.query.activeStorageAttachments.findMany({
        columns: { recordId: true },
        with: { blob: { columns: { key: true, filename: true } } },
        where: and(
          eq(activeStorageAttachments.recordType, "Document"),
          inArray(
            activeStorageAttachments.recordId,
            rows.map((document) => document.id),
          ),
        ),
      });
      const getUrl = (blob: Pick<typeof activeStorageBlobs.$inferSelect, "key" | "filename">) =>
        getS3Url(blob.key, blob.filename);
      const attachments = new Map(
        await Promise.all(
          attachmentRows.map(async (attachment) => [attachment.recordId, await getUrl(attachment.blob)] as const),
        ),
      );
      return {
        documents: rows.map((document) => ({
          ...pick(
            document,
            "id",
            "name",
            "createdAt",
            "completedAt",
            "docusealSubmissionId",
            "type",
            "contractorSignature",
            "administratorSignature",
          ),
          user: simpleUser(document.user),
          attachment: attachments.get(document.id),
          lawyerApproved: document.boardConsents.some((consent) => consent.lawyerApprovedAt),
        })),
        total,
      };
    }),
  years: companyProcedure.input(z.object({ userId: z.string().nullable() })).query(async ({ ctx, input }) => {
    if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
      throw new TRPCError({ code: "FORBIDDEN" });

    const where = visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined);
    const rows = await db
      .selectDistinct(pick(documents, "year"))
      .from(documents)
      .where(where)
      .orderBy(desc(documents.year));
    return rows.map((row) => row.year);
  }),
  getUrl: companyProcedure.input(z.object({ id: z.bigint() })).query(async ({ ctx, input }) => {
    const document = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, input.id),
        visibleDocuments(ctx.company.id, ctx.companyAdministrator || ctx.companyLawyer ? undefined : ctx.user.id),
        isNotNull(documents.completedAt),
      ),
    });
    if (!document?.docusealSubmissionId) throw new TRPCError({ code: "NOT_FOUND" });
    const submission = await docuseal.getSubmission(document.docusealSubmissionId);
    return assertDefined(submission.documents[0]).url;
  }),
  // TODO set up a DocuSeal webhook instead
  sign: companyProcedure
    .input(z.object({ id: z.bigint(), role: z.enum(["Company Representative", "Signer"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.role === "Company Representative" && !ctx.companyAdministrator && !ctx.companyLawyer)
        throw new TRPCError({ code: "FORBIDDEN" });
      const document = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.id),
          input.role === "Company Representative"
            ? and(eq(documents.companyId, ctx.company.id), isNull(documents.administratorSignature))
            : and(eq(documents.userId, ctx.user.id), isNull(documents.contractorSignature)),
        ),
      });
      if (!document) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(documents)
        .set({
          [input.role === "Company Representative" ? "administratorSignature" : "contractorSignature"]:
            ctx.user.legalName,
          completedAt: document.administratorSignature || document.contractorSignature ? new Date() : undefined,
        })
        .where(eq(documents.id, input.id));
    }),
  approveByLawyer: companyProcedure.input(z.object({ id: z.bigint() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, input.id), eq(documents.companyId, ctx.company.id)),
      with: { boardConsents: true },
    });
    if (!document) throw new TRPCError({ code: "NOT_FOUND" });
    if (document.type !== DocumentType.BoardConsent) throw new TRPCError({ code: "BAD_REQUEST" });

    const boardConsent = document.boardConsents.find((consent) => consent.status === "pending");
    if (!boardConsent) throw new TRPCError({ code: "BAD_REQUEST" });

    await db
      .update(boardConsents)
      .set({
        status: "lawyer_approved",
        lawyerApprovedAt: new Date(),
      })
      .where(eq(boardConsents.id, boardConsent.id));

    await inngest.send({
      name: "board_consent.lawyer_approved",
      data: {
        boardConsentId: boardConsent.id,
        userId: document.userId,
        companyId: document.companyId,
      },
    });
  }),
  templates: templatesRouter,
});
