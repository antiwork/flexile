import { TRPCError } from "@trpc/server";
import { isFuture } from "date-fns";
import { and, desc, eq, exists, isNotNull, isNull, sql } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { DocumentType, PayRateType } from "@/db/enums";
import { companyContractors, documents, documentSignatures, users } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { assertDefined } from "@/utils/assert";
import { latestUserComplianceInfo, simpleUser } from "../users";

type CompanyContractor = typeof companyContractors.$inferSelect;

export const contractorsRouter = createRouter({
  list: companyProcedure
    .input(z.object({ excludeAlumni: z.boolean().optional(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
      const where = and(
        eq(companyContractors.companyId, ctx.company.id),
        input.excludeAlumni ? isNull(companyContractors.endedAt) : undefined,
      );
      const rows = await db.query.companyContractors.findMany({
        where,
        with: {
          user: {
            with: {
              userComplianceInfos: latestUserComplianceInfo,
              wiseRecipients: { columns: { id: true }, limit: 1 },
            },
          },
        },
        orderBy: desc(companyContractors.id),
        limit: input.limit,
      });
      const workers = rows.map((worker) => ({
        ...pick(worker, [
          "startedAt",
          "payRateInSubunits",
          "endedAt",
          "role",
          "payRateType",
          "contractSignedElsewhere",
        ]),
        id: worker.externalId,
        user: {
          ...simpleUser(worker.user),
          ...pick(worker.user, "countryCode", "invitationAcceptedAt"),
          onboardingCompleted: worker.user.legalName && worker.user.preferredName && worker.user.countryCode,
        } as const,
      }));
      return workers.filter((worker) => worker.role);
    }),
  get: companyProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const contractor = await db.query.companyContractors.findFirst({
      where: and(
        eq(companyContractors.companyId, ctx.company.id),
        eq(companyContractors.userId, byExternalId(users, input.userId)),
      ),
    });
    if (!contractor) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...pick(contractor, ["payRateInSubunits", "endedAt", "role", "payRateType", "equityPercentage"]),
      id: contractor.externalId,
    };
  }),
  update: companyProcedure
    .input(
      createUpdateSchema(companyContractors)
        .pick({ payRateInSubunits: true, role: true, payRateType: true })
        .extend({ id: z.string(), payRateType: z.nativeEnum(PayRateType).optional() }),
    )
    .mutation(async ({ ctx, input }) =>
      db.transaction(async (tx) => {
        if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
        const contractor = await tx.query.companyContractors.findFirst({
          where: and(eq(companyContractors.companyId, ctx.company.id), eq(companyContractors.externalId, input.id)),
          with: { user: true },
        });
        if (!contractor) throw new TRPCError({ code: "NOT_FOUND" });
        await tx
          .update(companyContractors)
          .set(pick(input, ["payRateInSubunits", "role", "payRateType"]))
          .where(eq(companyContractors.id, contractor.id));
        let documentId: bigint | null = null;
        if (input.payRateInSubunits != null && input.payRateInSubunits !== contractor.payRateInSubunits) {
          if (!contractor.contractSignedElsewhere) {
            await tx.delete(documents).where(
              and(
                eq(documents.type, DocumentType.ConsultingContract),
                exists(
                  tx
                    .select({ _: sql`1` })
                    .from(documentSignatures)
                    .where(
                      and(
                        eq(documentSignatures.documentId, documents.id),
                        eq(documentSignatures.userId, contractor.userId),
                        isNull(documentSignatures.signedAt),
                      ),
                    ),
                ),
              ),
            );
            const [document] = await tx
              .insert(documents)
              .values({
                name: "Consulting agreement",
                year: new Date().getFullYear(),
                companyId: ctx.company.id,
                type: DocumentType.ConsultingContract,
              })
              .returning();
            documentId = assertDefined(document).id;

            await tx.insert(documentSignatures).values([
              {
                documentId,
                userId: ctx.companyAdministrator.userId,
                title: "Company Representative",
              },
              {
                documentId,
                userId: contractor.userId,
                title: "Signer",
              },
            ]);
          }
        }
        return { documentId };
      }),
    ),
  cancelContractEnd: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const contractor = await db.query.companyContractors.findFirst({
      with: { user: true },
      where: and(
        eq(companyContractors.externalId, input.id),
        eq(companyContractors.companyId, ctx.company.id),
        isNotNull(companyContractors.endedAt),
      ),
    });

    if (!contractor) throw new TRPCError({ code: "NOT_FOUND" });

    await db.update(companyContractors).set({ endedAt: null }).where(eq(companyContractors.id, contractor.id));
  }),

  endContract: companyProcedure
    .input(
      z.object({
        id: z.string(),
        endDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const activeContractor = await db.query.companyContractors.findFirst({
        with: {
          user: true,
        },
        where: and(
          eq(companyContractors.externalId, input.id),
          eq(companyContractors.companyId, ctx.company.id),
          isNull(companyContractors.endedAt),
        ),
      });

      if (!activeContractor) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(companyContractors)
        .set({ endedAt: new Date(input.endDate) })
        .where(eq(companyContractors.id, activeContractor.id));
    }),
});

export const isActive = (contractor: CompanyContractor | undefined): contractor is CompanyContractor =>
  !!contractor && (!contractor.endedAt || isFuture(contractor.endedAt));
