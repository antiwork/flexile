import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, not, type SQLWrapper } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, documents, documentSignatures, users } from "@/db/schema";
import env from "@/env";
import { companyProcedure, createRouter } from "@/trpc";
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
        and(
          isNull(documentSignatures.signedAt),
          input.userId ? undefined : eq(documentSignatures.title, "Company Representative"),
        ),
      );
      const where = and(
        visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined),
        input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
      );
      const rows = await db
        .selectDistinctOn([documents.id], {
          ...pick(documents, "id", "name", "createdAt", "type"),
          attachment: pick(activeStorageBlobs, "key", "filename"),
        })
        .from(documents)
        .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
        .innerJoin(users, eq(documentSignatures.userId, users.id))
        .leftJoin(
          activeStorageAttachments,
          and(eq(activeStorageAttachments.recordType, "Document"), eq(documents.id, activeStorageAttachments.recordId)),
        )
        .leftJoin(activeStorageBlobs, eq(activeStorageAttachments.blobId, activeStorageBlobs.id))
        .where(where)
        .orderBy(desc(documents.id));

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

      return rows.map((document) => ({
        ...document,
        signatories: signatories
          .filter((signature) => signature.documentId === document.id)
          .map((signature) => ({
            ...simpleUser(signature.user),
            title: signature.title,
            signedAt: signature.signedAt,
          })),
      }));
    }),
  templates: templatesRouter,
});
