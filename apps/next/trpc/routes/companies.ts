import { TRPCError } from "@trpc/server";
import { subYears } from "date-fns";
import { and, eq, gt, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType, PayRateType } from "@/db/enums";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  companies,
  companyAdministrators,
  companyContractors,
  documents,
  documentTemplates,
  invoices,
  users,
} from "@/db/schema";
import { baseProcedure, companyProcedure, createRouter, protectedProcedure } from "@/trpc";
import { createSubmission } from "@/trpc/routes/documents/templates";
import { assertDefined } from "@/utils/assert";
import {
  company_administrator_stripe_microdeposit_verifications_url,
  company_invitations_url,
  microdeposit_verification_details_company_invoices_url,
} from "@/utils/routes";

export const companyName = (company: Pick<typeof companies.$inferSelect, "publicName" | "name">) =>
  company.publicName ?? company.name;
export const companyLogoUrl = async (id: bigint) => {
  const logo = await db.query.activeStorageAttachments.findFirst({
    where: companyLogo(id),
    with: { blob: true },
  });
  return logo?.blob ? `https://${process.env.S3_PUBLIC_BUCKET}.s3.amazonaws.com/${logo.blob.key}` : null;
};

const companyLogo = (id: bigint) =>
  and(
    eq(activeStorageAttachments.recordType, "Company"),
    eq(activeStorageAttachments.recordId, id),
    eq(activeStorageAttachments.name, "logo"),
  );

const decimalRegex = /^\d+(\.\d+)?$/u;

export const companiesRouter = createRouter({
  list: protectedProcedure.input(z.object({ invited: z.literal(true) })).query(
    async ({ ctx }) =>
      await db
        .select({ email: users.email, company: companies.name })
        .from(users)
        .innerJoin(companyAdministrators, eq(users.id, companyAdministrators.userId))
        .innerJoin(companies, eq(companyAdministrators.companyId, companies.id))
        .where(and(eq(users.invitedByType, "User"), eq(users.invitedById, BigInt(ctx.userId)))),
  ),
  settings: companyProcedure.query(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return pick(ctx.company, [
      "taxId",
      "brandColor",
      "website",
      "description",
      "showStatsInJobDescriptions",
      "name",
      "phoneNumber",
    ]);
  }),
  update: companyProcedure
    .input(
      createUpdateSchema(companies, {
        brandColor: (z) => z.regex(/^#([0-9A-F]{6})$/iu, "Invalid hex color"),
        conversionSharePriceUsd: (z) => z.regex(decimalRegex),
        sharePriceInUsd: (z) => z.regex(decimalRegex),
        fmvPerShareInUsd: (z) => z.regex(decimalRegex),
      })
        .pick({
          name: true,
          taxId: true,
          phoneNumber: true,
          streetAddress: true,
          city: true,
          state: true,
          zipCode: true,
          publicName: true,
          website: true,
          description: true,
          brandColor: true,
          showStatsInJobDescriptions: true,
          sharePriceInUsd: true,
          fmvPerShareInUsd: true,
          conversionSharePriceUsd: true,
        })
        .extend({ logoKey: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      await db.transaction(async (tx) => {
        await tx.update(companies).set(input).where(eq(companies.id, ctx.company.id));

        if (input.logoKey) {
          await tx.delete(activeStorageAttachments).where(companyLogo(ctx.company.id));
          const blob = await tx.query.activeStorageBlobs.findFirst({
            where: eq(activeStorageBlobs.key, input.logoKey),
          });
          if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "Logo not found" });
          await tx.insert(activeStorageAttachments).values({
            name: "logo",
            blobId: blob.id,
            recordType: "Company",
            recordId: ctx.company.id,
          });
        }
      });
    }),
  publicInfo: baseProcedure.input(z.object({ companyId: z.string() })).query(async ({ input }) => {
    const company = await db.query.companies.findFirst({
      where: eq(companies.externalId, input.companyId),
    });
    if (!company) throw new TRPCError({ code: "NOT_FOUND" });

    const response = {
      ...pick(
        company,
        "website",
        "description",
        "equityGrantsEnabled",
        "sharePriceInUsd",
        "fmvPerShareInUsd",
      ),
      name: companyName(company),
      additionalSupportedCountries: company.isGumroad ? ["BR"] : [],
      logoUrl: await companyLogoUrl(company.id),
    };

    if (!company.showStatsInJobDescriptions) return response;

    const [avgTenure] = await db
      .select({
        avg: sql`
            AVG(EXTRACT(DAY FROM (COALESCE(${companyContractors.endedAt}, NOW()) - ${companyContractors.startedAt}))) / 365
          `.mapWith(Number),
      })
      .from(companyContractors)
      .where(
        and(
          eq(companyContractors.companyId, company.id),
          gt(
            db.$count(
              invoices,
              and(eq(invoices.companyContractorId, companyContractors.id), eq(invoices.status, "paid")),
            ),
            2,
          ),
        ),
      );

    const result = await db
      .select({
        totalHours: sql<number>`
            SUM(${invoices.totalMinutes} / 60.0)
          `.mapWith(Number),
        hoursPerWeek: companyContractors.hoursPerWeek,
      })
      .from(invoices)
      .innerJoin(companyContractors, eq(companyContractors.id, invoices.companyContractorId))
      .where(
        and(
          eq(companyContractors.companyId, company.id),
          isNull(companyContractors.endedAt),
          eq(companyContractors.payRateType, PayRateType.Hourly),
          gte(invoices.createdAt, subYears(new Date(), 1)),
          isNotNull(companyContractors.hoursPerWeek),
        ),
      )
      .groupBy(companyContractors.id)
      .having(sql`COUNT(${invoices.id}) > 2`);

    return {
      ...response,
      stats: {
        freelancers: result.length,
        avgWeeksPerYear: result.reduce((sum, row) => sum + row.totalHours / (row.hoursPerWeek ?? 1), 0) / result.length,
        avgHoursPerWeek: result.reduce((sum, row) => sum + (row.hoursPerWeek ?? 0), 0) / result.length,
        avgTenure: assertDefined(avgTenure).avg,
        attritionRate: 1,
      },
    };
  }),
  microdepositVerificationDetails: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(
      microdeposit_verification_details_company_invoices_url(ctx.company.externalId, { host: ctx.host }),
      { headers: ctx.headers },
    );
    const data = z
      .object({
        details: z
          .object({
            arrival_timestamp: z.number(),
            microdeposit_type: z.enum(["descriptor_code", "amounts"]),
            bank_account_number: z.string().nullable(),
          })
          .nullable(),
      })
      .parse(await response.json());
    return { microdepositVerificationDetails: data.details };
  }),
  microdepositVerification: companyProcedure
    .input(z.object({ code: z.string() }).or(z.object({ amounts: z.array(z.number()) })))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const response = await fetch(
        company_administrator_stripe_microdeposit_verifications_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: { "Content-Type": "application/json", ...ctx.headers },
        },
      );

      if (!response.ok) {
        const { error } = z.object({ error: z.string() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: error });
      }
    }),
  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        companyName: z.string(),
        roleName: z.string(),
        rate: z.number(),
        rateType: z.nativeEnum(PayRateType),
        hoursPerWeek: z.number().nullish(),
        startDate: z.string(),
        templateId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.externalId, input.templateId),
          eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
          isNull(documentTemplates.companyId),
        ),
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      const response = await fetch(company_invitations_url({ host: ctx.host }), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ctx.headers },
        body: JSON.stringify({
          company_administrator: { email: input.email },
          company: { name: input.companyName },
          company_role: { name: input.roleName },
          company_role_rate: {
            pay_rate_in_subunits: input.rate,
            pay_rate_type: input.rateType,
          },
          company_worker: {
            pay_rate_in_subunits: input.rate,
            started_at: input.startDate,
            pay_rate_type: input.rateType,
            hours_per_week: input.rateType === PayRateType.Hourly ? input.hoursPerWeek : null,
          },
        }),
      });
      if (!response.ok) throw new TRPCError({ code: "BAD_REQUEST", message: await response.text() });

      const { new_user_id, document_id } = z
        .object({ new_user_id: z.number(), document_id: z.number() })
        .parse(await response.json());
      const user = assertDefined(await db.query.users.findFirst({ where: eq(users.id, BigInt(new_user_id)) }));
      const submission = await createSubmission(ctx, template.docusealId, user, "Signer");
      const [document] = await db
        .update(documents)
        .set({ docusealSubmissionId: submission.id })
        .where(eq(documents.id, BigInt(document_id)))
        .returning();
      // TODO remove this flag
      await db.update(users).set({ invitingCompany: false }).where(eq(users.id, ctx.user.id));
      return { documentId: assertDefined(document?.id) };
    }),
});
