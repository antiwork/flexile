import { TRPCError } from "@trpc/server";
import { isFuture } from "date-fns";
import { and, desc, eq, exists, isNotNull, isNull, or, sql } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { DocumentTemplateType, DocumentType, PayRateType } from "@/db/enums";
import {
  companyContractors,
  documents,
  documentSignatures,
  documentTemplates,
  equityAllocations,
  users,
} from "@/db/schema";
import env from "@/env";
import { sanctionedCountries } from "@/models/constants";
import { companyProcedure, createRouter } from "@/trpc";
import { sendEmail } from "@/trpc/email";
import { createSubmission } from "@/trpc/routes/documents/templates";
import { assertDefined } from "@/utils/assert";
import { company_workers_url } from "@/utils/routes";
import { latestUserComplianceInfo, simpleUser, type User } from "../users";
import RateUpdated from "./RateUpdated";

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
        ...pick(worker, ["startedAt", "payRateInSubunits", "hoursPerWeek", "endedAt", "role", "payRateType"]),
        id: worker.externalId,
        user: {
          ...simpleUser(worker.user),
          ...pick(worker.user, "countryCode", "invitationAcceptedAt"),
          onboardingCompleted: isOnboardingCompleted(worker.user),
        } as const,
      }));
      return workers;
    }),
  get: companyProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const contractor = await db.query.companyContractors.findFirst({
      where: and(
        eq(companyContractors.companyId, ctx.company.id),
        eq(companyContractors.userId, byExternalId(users, input.userId)),
      ),
      with: {
        equityAllocations: { where: eq(equityAllocations.year, new Date().getFullYear()) },
      },
    });
    if (!contractor) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...pick(contractor, ["payRateInSubunits", "hoursPerWeek", "endedAt", "role"]),
      id: contractor.externalId,
      payRateType: contractor.payRateType,
      equityPercentage: contractor.equityAllocations[0]?.equityPercentage ?? 0,
    };
  }),
  create: companyProcedure
    .input(
      z.object({
        email: z.string(),
        startedAt: z.string(),
        payRateInSubunits: z.number(),
        payRateType: z.nativeEnum(PayRateType),
        hoursPerWeek: z.number().nullable(),
        role: z.string(),
        documentTemplateId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.externalId, input.documentTemplateId),
          or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
          eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
        ),
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      const response = await fetch(company_workers_url(ctx.company.externalId, { host: ctx.host }), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ctx.headers },
        body: JSON.stringify({
          contractor: {
            email: input.email,
            started_at: input.startedAt,
            pay_rate_in_subunits: input.payRateInSubunits,
            pay_rate_type:
              input.payRateType === PayRateType.Hourly
                ? "hourly"
                : input.payRateType === PayRateType.ProjectBased
                  ? "project_based"
                  : "salary",
            role: input.role,
            ...(input.payRateType === PayRateType.Hourly && { hours_per_week: input.hoursPerWeek }),
          },
        }),
      });
      if (!response.ok) {
        const json = z.object({ error_message: z.string() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: json.error_message });
      }
      if (input.payRateType === PayRateType.Salary) return { documentId: null };
      const { new_user_id, document_id } = z
        .object({ new_user_id: z.number(), document_id: z.number() })
        .parse(await response.json());
      const user = assertDefined(await db.query.users.findFirst({ where: eq(users.id, BigInt(new_user_id)) }));
      const submission = await createSubmission(ctx, template.docusealId, user, "Company Representative");
      const [document] = await db
        .update(documents)
        .set({ docusealSubmissionId: submission.id })
        .where(and(eq(documents.id, BigInt(document_id))))
        .returning();
      return { documentId: document?.id };
    }),
  update: companyProcedure
    .input(
      createUpdateSchema(companyContractors)
        .pick({ payRateInSubunits: true, payRateType: true, hoursPerWeek: true, role: true })
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
          .set(pick(input, ["payRateInSubunits", "payRateType", "hoursPerWeek", "role"]))
          .where(eq(companyContractors.id, contractor.id));
        let documentId: bigint | null = null;
        if (input.payRateInSubunits != null && input.payRateInSubunits !== contractor.payRateInSubunits) {
          const payRateType = input.payRateType ?? contractor.payRateType;
          if (payRateType !== PayRateType.Salary) {
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
            // TODO store which template was used for the previous contract
            const template = await db.query.documentTemplates.findFirst({
              where: and(
                or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
                eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
              ),
              orderBy: desc(documentTemplates.createdAt),
            });
            const submission = await createSubmission(
              ctx,
              assertDefined(template).docusealId,
              contractor.user,
              "Company Representative",
            );
            const [document] = await tx
              .insert(documents)
              .values({
                name: "Consulting agreement",
                year: new Date().getFullYear(),
                companyId: ctx.company.id,
                type: DocumentType.ConsultingContract,
                docusealSubmissionId: submission.id,
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
          if (payRateType === PayRateType.Hourly) {
            await sendEmail({
              from: `Flexile <support@${env.DOMAIN}>`,
              to: contractor.user.email,
              replyTo: ctx.company.email,
              subject: `Your rate has changed!`,
              react: RateUpdated({
                host: ctx.host,
                oldRate: contractor.payRateInSubunits,
                newRate: input.payRateInSubunits,
                documentId,
              }),
            });
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

const isOnboardingCompleted = (user: User & { wiseRecipients: unknown[] }) =>
  user.legalName &&
  user.preferredName &&
  (user.wiseRecipients.length > 0 || (user.countryCode && sanctionedCountries.has(user.countryCode)));

export const isActive = (contractor: CompanyContractor | undefined): contractor is CompanyContractor =>
  !!contractor && (!contractor.endedAt || isFuture(contractor.endedAt));
