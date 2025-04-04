import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { max } from "date-fns";
import Decimal from "decimal.js";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import jwt from "jsonwebtoken";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType, DocumentType, PayRateType } from "@/db/enums";
import { documents, documentTemplates, equityAllocations, users } from "@/db/schema";
import env from "@/env";
import { countries, MAX_WORKING_HOURS_PER_WEEK, WORKING_WEEKS_PER_YEAR } from "@/models/constants";
import { companyProcedure, createRouter, type ProtectedContext, protectedProcedure } from "@/trpc";
import { assertDefined } from "@/utils/assert";
docuseal.configure({ key: env.DOCUSEAL_TOKEN });

export const createSubmission = (
  ctx: ProtectedContext,
  templateId: bigint,
  target: typeof users.$inferSelect,
  role: "Company Representative" | "Signer",
) =>
  docuseal.createSubmission({
    template_id: Number(templateId),
    send_email: false,
    submitters: [
      { email: ctx.user.email, role, external_id: ctx.user.id.toString() },
      {
        email: target.email,
        role: role === "Signer" ? "Company Representative" : "Signer",
        external_id: target.id.toString(),
      },
    ],
  });

export const templatesRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(DocumentTemplateType).optional(),
        signable: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.company && !ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await db.query.documentTemplates.findMany({
        where: and(
          or(
            ctx.company ? eq(documentTemplates.companyId, ctx.company.id) : undefined,
            isNull(documentTemplates.companyId),
          ),
          input.type != null ? eq(documentTemplates.type, input.type) : undefined,
          input.signable != null ? eq(documentTemplates.signable, input.signable) : undefined,
        ),
        orderBy: asc(documentTemplates.updatedAt),
      });

      return rows.map((template) => ({
        id: template.externalId,
        ...pick(template, ["name", "type", "docusealId", "updatedAt"]),
        generic: !template.companyId,
      }));
    }),
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

    const [template] = await db.query.documentTemplates.findMany({
      columns: { name: true, type: true, docusealId: true, companyId: true },
      where: and(
        eq(documentTemplates.externalId, input.id),
        or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
      ),
    });

    if (!template) throw new TRPCError({ code: "NOT_FOUND" });

    const token = jwt.sign(
      {
        user_email: env.DOCUSEAL_USER_EMAIL,
        integration_email: ctx.company.email,
        document_urls: [],
        folder_name: ctx.company.slug,
        template_id: Number(template.docusealId),
      },
      env.DOCUSEAL_TOKEN,
    );

    return { template, token };
  }),
  getSubmitterSlug: companyProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.docusealSubmissionId, input.id), eq(documents.companyId, ctx.company.id)),
      with: {
        contractor: {
          with: {
            role: true,
            equityAllocations: { where: eq(equityAllocations.year, new Date().getFullYear()) },
          },
        },
        equityGrant: {
          with: { optionPool: true, vestingSchedule: true },
        },
      },
    });
    if (!document) throw new TRPCError({ code: "NOT_FOUND" });

    const submission = await docuseal.getSubmission(input.id);
    const submitter = submission.submitters.find(
      (s) =>
        ((s.role === "Company Representative" && (ctx.companyAdministrator || ctx.companyLawyer)) ||
          s.external_id === String(ctx.user.id)) &&
        (s.status === "awaiting" || s.status === "opened"),
    );
    if (!submitter) throw new TRPCError({ code: "NOT_FOUND" });

    const complianceInfo = ctx.user.userComplianceInfos[0];
    const values: Record<string, string> = {
      __companyEmail: ctx.user.email,
      __companyRepresentativeName: ctx.user.legalName ?? "",
      __companyName: ctx.company.name ?? "",
      __companyAddress:
        [ctx.company.streetAddress, ctx.company.city, ctx.company.state, ctx.company.zipCode]
          .filter(Boolean)
          .join(", ") || "",
      __companyCountry: (ctx.company.countryCode && countries.get(ctx.company.countryCode)) ?? "",
      __signerEmail: ctx.user.email,
      __signerAddress:
        [ctx.user.streetAddress, ctx.user.city, ctx.user.state, ctx.user.zipCode].filter(Boolean).join(", ") || "",
      __signerCountry: (ctx.user.countryCode && countries.get(ctx.user.countryCode)) ?? "",
      __signerName: ctx.user.legalName ?? "",
      __signerLegalEntity: (complianceInfo?.businessEntity ? complianceInfo.businessName : ctx.user.legalName) ?? "",
    };
    if (document.type === DocumentType.ConsultingContract) {
      const contractor = document.contractor;
      if (!contractor) throw new TRPCError({ code: "NOT_FOUND" });
      const equityPercentage = contractor.equityAllocations[0]?.equityPercentage;
      const startDate = max([contractor.startedAt, contractor.updatedAt]);
      Object.assign(values, {
        __role: contractor.role.name,
        __startDate: startDate.toLocaleString(),
        __electionYear: startDate.getFullYear().toString(),
        __payRate: `${(contractor.payRateInSubunits / 100).toLocaleString()} ${
          contractor.payRateType === PayRateType.Hourly
            ? "per hour"
            : contractor.payRateType === PayRateType.ProjectBased
              ? "per project"
              : "per year"
        }`,
        __targetAnnualHours:
          contractor.payRateType === PayRateType.Hourly && contractor.hoursPerWeek
            ? `Target Annual Hours: ${(contractor.hoursPerWeek * WORKING_WEEKS_PER_YEAR).toLocaleString()}`
            : "",
        __maximumFee:
          contractor.payRateType === PayRateType.Hourly && contractor.hoursPerWeek
            ? `Maximum fee payable to Contractor on this Project Assignment, including all items in the first two paragraphs above is $${((contractor.payRateInSubunits / 100) * MAX_WORKING_HOURS_PER_WEEK * WORKING_WEEKS_PER_YEAR).toLocaleString()} (the "Maximum Fee").`
            : "",
      });
      if (equityPercentage) values.__signerEquityPercentage = equityPercentage.toString();
    } else if (document.type === DocumentType.EquityPlanContract) {
      const equityGrant = document.equityGrant;
      if (!equityGrant) throw new TRPCError({ code: "NOT_FOUND" });

      Object.assign(values, {
        __name: equityGrant.optionHolderName,
        __boardApprovalDate: equityGrant.boardApprovalDate,
        __quantity: equityGrant.numberOfShares.toString(),
        __relationship: equityGrant.issueDateRelationship,
        __grantType: equityGrant.optionGrantType === "iso" ? "Incentive Stock Option" : "Nonstatutory Stock Option",
        __exercisePrice: equityGrant.exercisePriceUsd.toString(),
        __totalExercisePrice: new Decimal(equityGrant.exercisePriceUsd).mul(equityGrant.numberOfShares).toString(),
        __expirationDate: equityGrant.expiresAt.toLocaleDateString(),
        __optionPool: equityGrant.optionPool.name,
        __vestingCommencementDate: equityGrant.periodStartedAt.toLocaleDateString(),
        __exerciseSchedule: "Same as Vesting Schedule",
      });

      const vestingSchedule = equityGrant.vestingSchedule;
      if (vestingSchedule) {
        values.__vestingSchedule = `${vestingSchedule.vestingFrequencyMonths}/${vestingSchedule.totalVestingDurationMonths} of the total Shares shall vest monthly on the same day each month as the Vesting Commencement Date${vestingSchedule.cliffDurationMonths > 0 ? `, with ${vestingSchedule.cliffDurationMonths} months cliff` : ""}, subject to the service provider's Continuous Service (as defined in the Plan) through each vesting date.`;
      } else if (equityGrant.vestingTrigger === "invoice_paid") {
        values.__vestingSchedule = `Shares will vest as invoices are paid. The number of shares vesting each month will be equal to the total dollar amount of eligible fees billed to and approved by the Company during that month, times the equity allocation percentage selected, divided by the value per share of the Company's common stock on the Effective Date of the Equity Election Form (which for purposes of the vesting of this award will be either a) the fully diluted share price associated with the last SAFE valuation cap, or b) the share price of the last preferred stock sale, whichever is most recent, as determined by the Board). Any options that remain unvested at the conclusion of the calendar year after giving effect to any vesting earned for the month of December will be forfeited for no consideration.`;
      }
    }

    await docuseal.updateSubmitter(submitter.id, { values });

    return { slug: submitter.slug, readonlyFields: Object.keys(values) };
  }),
  create: companyProcedure
    .input(createInsertSchema(documentTemplates).pick({ name: true, type: true }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

      const template = await docuseal.createTemplateFromPdf({ documents: [], name: input.name });
      const [row] = await db
        .insert(documentTemplates)
        .values({ ...input, companyId: ctx.company.id, docusealId: BigInt(template.id) })
        .returning();

      return assertDefined(row).externalId;
    }),
  update: companyProcedure
    .input(createUpdateSchema(documentTemplates).pick({ name: true, signable: true }).extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

      const [row] = await db
        .update(documentTemplates)
        .set(pick(input, "name", "signable"))
        .where(and(eq(documentTemplates.externalId, input.id), eq(documentTemplates.companyId, ctx.company.id)))
        .returning();

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    }),
});
