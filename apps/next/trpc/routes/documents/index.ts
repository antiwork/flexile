import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull, not, sql, type SQLWrapper } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { DocumentType } from "@/db/enums";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  boardConsents,
  documents,
  documentSignatures,
  users,
} from "@/db/schema";
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
    userId ? eq(documentSignatures.userId, userId) : undefined,
  );
export const documentsRouter = createRouter({
  list: companyProcedure
    .input(z.object({ userId: z.string().nullable(), signable: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
        throw new TRPCError({ code: "FORBIDDEN" });

      const signable = assertDefined(
        and(isNotNull(documents.docusealSubmissionId), isNull(documentSignatures.signedAt)),
      );
      const where = and(
        visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined),
        input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
      );
      const rows = await db
        .select({
          ...pick(documents, "id", "name", "createdAt", "docusealSubmissionId", "type"),
          lawyerApproved: sql<boolean>`${boardConsents.lawyerApprovedAt} IS NOT NULL`,
        })
        .from(documents)
        .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
        .innerJoin(users, eq(documentSignatures.userId, users.id))
        .leftJoin(boardConsents, eq(documents.id, boardConsents.documentId))
        .where(where)
        .orderBy(desc(documents.createdAt))
        .groupBy(documents.id, boardConsents.lawyerApprovedAt);

      const signatories = await db.query.documentSignatures.findMany({
        columns: { documentId: true, title: true, signedAt: true },
        where: and(
          inArray(
            documentSignatures.documentId,
            rows.map((document) => document.id),
          ),
        ),
        with: { user: { columns: simpleUser.columns } },
        orderBy: desc(documentSignatures.signedAt),
      });
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

      return rows.map((document) => ({
        ...pick(document, "id", "name", "createdAt", "docusealSubmissionId", "type", "lawyerApproved"),
        attachment: attachments.get(document.id),
        signatories: signatories
          .filter((signature) => signature.documentId === document.id)
          .map((signature) => ({
            ...simpleUser(signature.user),
            title: signature.title,
            signedAt: signature.signedAt,
          })),
      }));
    }),
  getUrl: companyProcedure.input(z.object({ id: z.bigint() })).query(async ({ ctx, input }) => {
    const [document] = await db
      .select({ docusealSubmissionId: documents.docusealSubmissionId })
      .from(documents)
      .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
      .where(
        and(
          eq(documents.id, input.id),
          visibleDocuments(ctx.company.id, ctx.companyAdministrator || ctx.companyLawyer ? undefined : ctx.user.id),
        ),
      )
      .limit(1);
    if (!document?.docusealSubmissionId) throw new TRPCError({ code: "NOT_FOUND" });
    const submission = await docuseal.getSubmission(document.docusealSubmissionId);
    return assertDefined(submission.documents[0]).url;
  }),
  // TODO set up a DocuSeal webhook instead
  sign: companyProcedure.input(z.object({ id: z.bigint(), role: z.string() })).mutation(async ({ ctx, input }) => {
    if (
      (input.role === "Company Representative" || input.role === "Board member") &&
      !ctx.companyAdministrator &&
      !ctx.companyLawyer
    )
      throw new TRPCError({ code: "FORBIDDEN" });
    const [document] = await db
      .select()
      .from(documents)
      .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
      .where(
        and(
          eq(documents.id, input.id),
          visibleDocuments(
            ctx.company.id,
            input.role === "Company Representative" || input.role === "Board member" ? undefined : ctx.user.id,
          ),
          eq(documentSignatures.title, input.role),
          isNull(documentSignatures.signedAt),
        ),
      )
      .limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND" });

    await db
      .update(documentSignatures)
      .set({ signedAt: new Date() })
      .where(
        and(
          eq(documentSignatures.documentId, input.id),
          isNull(documentSignatures.signedAt),
          eq(documentSignatures.title, input.role),
        ),
      );

    // Check if all signatures for this document have been signed
    const allSignatures = await db.select().from(documentSignatures).where(eq(documentSignatures.documentId, input.id));
    const allSigned = allSignatures.every((signature) => signature.signedAt !== null);

    return { documentId: input.id, complete: allSigned };
  }),
  approveByLawyer: companyProcedure.input(z.object({ id: z.bigint() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, input.id), eq(documents.companyId, ctx.company.id)),
      with: { boardConsents: true, signatures: true },
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
      name: "board-consent.lawyer-approved",
      data: {
        boardConsentId: String(boardConsent.id),
        documentId: String(document.id),
        companyId: String(document.companyId),
      },
    });
  }),
  approveByMember: companyProcedure.input(z.object({ id: z.bigint() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, input.id), eq(documents.companyId, ctx.company.id)),
      with: { boardConsents: true, signatures: true },
    });

    if (!document) throw new TRPCError({ code: "NOT_FOUND" });
    if (document.type !== DocumentType.BoardConsent) return null;

    const boardConsent = document.boardConsents.find((consent) => consent.status === "lawyer_approved");
    if (!boardConsent) throw new TRPCError({ code: "BAD_REQUEST" });

    await db
      .update(boardConsents)
      .set({
        status: "board_approved",
        boardApprovedAt: new Date(),
      })
      .where(eq(boardConsents.id, boardConsent.id));

    await inngest.send({
      name: "board-consent.member-approved",
      data: {
        boardConsentId: String(boardConsent.id),
      },
    });
  }),
  templates: templatesRouter,
});
