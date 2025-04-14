import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, inArray, isNotNull, isNull, not, type SQLWrapper } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db, paginate, paginationSchema } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, documents, documentSignatures, users } from "@/db/schema";
import env from "@/env";
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
    .input(
      paginationSchema.and(
        z.object({ userId: z.string().nullable(), year: z.number().optional(), signable: z.boolean().optional() }),
      ),
    )
    .query(async ({ ctx, input }) => {
      if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
        throw new TRPCError({ code: "FORBIDDEN" });

      const signable = assertDefined(
        and(isNotNull(documents.docusealSubmissionId), isNull(documentSignatures.signedAt)),
      );
      const where = and(
        visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined),
        input.year ? eq(documents.year, input.year) : undefined,
        input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
      );
      const rows = await paginate(
        db
          .selectDistinctOn([documents.id], {
            ...pick(documents, "id", "name", "createdAt", "docusealSubmissionId", "type"),
          })
          .from(documents)
          .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
          .innerJoin(users, eq(documentSignatures.userId, users.id))
          .where(where)
          .orderBy(documents.id, desc(documents.createdAt)),
        input,
      );
      const totalResult = await db
        .selectDistinct({ count: count(documents.id) })
        .from(documents)
        .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
        .where(where);
      const total = totalResult[0]?.count ?? 0;
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
      return {
        documents: rows.map((document) => ({
          ...pick(document, "id", "name", "createdAt", "docusealSubmissionId", "type"),
          attachment: attachments.get(document.id),
          signatories: signatories
            .filter((signature) => signature.documentId === document.id)
            .map((signature) => ({
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

    const where = visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined);
    const rows = await db
      .selectDistinct(pick(documents, "year"))
      .from(documents)
      .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
      .where(where)
      .orderBy(desc(documents.year));
    return rows.map((row) => row.year);
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
  sign: companyProcedure
    .input(z.object({ id: z.bigint(), role: z.enum(["Company Representative", "Signer"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.role === "Company Representative" && !ctx.companyAdministrator && !ctx.companyLawyer)
        throw new TRPCError({ code: "FORBIDDEN" });
      const [document] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, input.id),
            visibleDocuments(ctx.company.id, input.role === "Company Representative" ? undefined : ctx.user.id),
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
    }),
  templates: templatesRouter,
});
