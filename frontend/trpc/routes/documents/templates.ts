import docuseal from "@docuseal/api";
import { TRPCError } from "@trpc/server";
import { max } from "date-fns";
import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { DocumentType, PayRateType } from "@/db/enums";
import { companyContractors, documents } from "@/db/schema";
import env from "@/env";
import { countries } from "@/models/constants";
import { companyProcedure, createRouter } from "@/trpc";
import { assertDefined } from "@/utils/assert";
docuseal.configure({ key: env.DOCUSEAL_TOKEN });

export const templatesRouter = createRouter({
  getSubmitterSlug: companyProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.docusealSubmissionId, input.id), eq(documents.companyId, ctx.company.id)),
      with: {
        signatures: {
          with: {
            user: {
              with: {
                companyContractors: {
                  where: eq(companyContractors.companyId, ctx.company.id),
                },
              },
            },
          },
        },
        equityGrant: {
          with: {
            optionPool: true,
            vestingSchedule: true,
            companyInvestor: { with: { user: { columns: { state: true, countryCode: true } } } },
          },
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
      const contractor = assertDefined(
        document.signatures.find((s) => s.title === "Signer")?.user.companyContractors[0],
      );
      const startDate = max([contractor.startedAt, contractor.updatedAt]);
      Object.assign(values, {
        __role: contractor.role,
        __startDate: startDate.toLocaleString(),
        __electionYear: startDate.getFullYear().toString(),
        __payRate: contractor.payRateInSubunits
          ? `${(contractor.payRateInSubunits / 100).toLocaleString()} per ${contractor.payRateType === PayRateType.Hourly ? "hour" : "project"}`
          : "",
      });
    } else if (document.type === DocumentType.EquityPlanContract) {
      const equityGrant = document.equityGrant;
      if (!equityGrant) throw new TRPCError({ code: "NOT_FOUND" });

      Object.assign(values, {
        __name: equityGrant.optionHolderName,
        __companyName: ctx.company.name ?? "",
        __boardApprovalDate: equityGrant.boardApprovalDate ?? "",
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

      const { state, countryCode } = equityGrant.companyInvestor.user;
      values.__optionholderAddress = (countryCode === "US" ? state : countries.get(countryCode ?? "")) ?? "";
    }

    await docuseal.updateSubmitter(submitter.id, { values });

    return { slug: submitter.slug, readonlyFields: Object.keys(values) };
  }),
});
