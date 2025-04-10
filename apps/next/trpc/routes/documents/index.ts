import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull, not } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db, pagination, paginationSchema } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, documents, documentSignatures, users } from "@/db/schema";
import env from "@/env";
import { companyProcedure, createRouter, getS3Url } from "@/trpc";
import { simpleUser } from "@/trpc/routes/users";
import { assertDefined } from "@/utils/assert";
import { templatesRouter } from "./templates";

docuseal.configure({ key: env.DOCUSEAL_TOKEN });

const visibleDocuments = (companyId: bigint) => and(eq(documents.companyId, companyId), isNull(documents.deletedAt));
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

      const signable = isNotNull(documents.docusealSubmissionId);
      const signed = isNotNull(documentSignatures.signedAt);
      const where = and(
        visibleDocuments(ctx.company.id),
        input.year ? eq(documents.year, input.year) : undefined,
        input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
      );
      const rows = await db.query.documents.findMany({
        with: {
          signatures: {
            with: { user: { columns: simpleUser.columns } },
            where: and(
              input.userId ? eq(documentSignatures.userId, byExternalId(users, input.userId)) : undefined,
              input.signable != null ? (input.signable ? not(signed) : signed) : undefined,
            ),
            orderBy: [desc(documentSignatures.signedAt)],
          },
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
          ...pick(document, "id", "name", "createdAt", "docusealSubmissionId", "type"),
          attachment: attachments.get(document.id),
          completedAt: document.signatures.every((signature) => signature.signedAt)
            ? assertDefined(document.signatures[0]).signedAt
            : null,
          signable: document.signatures.some((signature) => !signature.signedAt),
          signatories: document.signatures.map((signature) => ({
            ...simpleUser(signature.user),
            title: signature.title,
            signedAt: signature.signedAt,
          })),
        })),
        total,
      };
    }),
  years: companyProcedure.input(z.object({ userId: z.string().nullable() })).query(async ({ ctx, input }) => {
    if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
      throw new TRPCError({ code: "FORBIDDEN" });

    const rows = await db
      .selectDistinct(pick(documents, "year"))
      .from(documents)
      .leftJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
      .where(
        and(
          visibleDocuments(ctx.company.id),
          input.userId ? eq(documentSignatures.userId, byExternalId(users, input.userId)) : undefined,
        ),
      )
      .orderBy(desc(documents.year));
    return rows.map((row) => row.year);
  }),
  getUrl: companyProcedure.input(z.object({ id: z.bigint() })).query(async ({ ctx, input }) => {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, input.id), visibleDocuments(ctx.company.id)),
      with:
        !ctx.companyAdministrator && !ctx.companyLawyer
          ? { signatures: { where: eq(documentSignatures.userId, ctx.user.id) } }
          : undefined,
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
        where: eq(documents.id, input.id),
        with: {
          signatures: {
            where: and(
              eq(documentSignatures.userId, ctx.user.id),
              eq(documentSignatures.title, input.role),
              isNull(documentSignatures.signedAt),
            ),
          },
        },
      });
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
    }),
  templates: templatesRouter,
});
