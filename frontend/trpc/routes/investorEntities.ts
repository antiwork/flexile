import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { companyInvestorEntities, equityGrants, shareHoldings } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

const RECORDS_PER_SECTION = 20;

export const investorEntitiesRouter = createRouter({
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "NOT_FOUND" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const investorEntity = await db.query.companyInvestorEntities.findFirst({
      where: and(
        eq(companyInvestorEntities.companyId, ctx.company.id),
        eq(companyInvestorEntities.externalId, input.id),
      ),
    });
    if (!investorEntity) throw new TRPCError({ code: "NOT_FOUND" });

    const grants = (
      await db.query.equityGrants.findMany({
        where: and(
          eq(equityGrants.companyInvestorEntityId, byExternalId(companyInvestorEntities, input.id)),
          or(gt(equityGrants.vestedShares, 0), gt(equityGrants.unvestedShares, 0), eq(equityGrants.exercisedShares, 0)),
        ),
        limit: RECORDS_PER_SECTION,
        orderBy: [desc(equityGrants.issuedAt)],
      })
    ).map((grant) => ({
      issuedAt: grant.issuedAt,
      numberOfShares: grant.numberOfShares,
      vestedShares: grant.vestedShares,
      unvestedShares: grant.unvestedShares,
      exercisedShares: grant.exercisedShares,
      vestedAmountUsd: grant.vestedAmountUsd,
      exercisePriceUsd: grant.exercisePriceUsd,
    }));

    const shares = (
      await db.query.shareHoldings.findMany({
        where: eq(shareHoldings.companyInvestorEntityId, byExternalId(companyInvestorEntities, input.id)),
        limit: RECORDS_PER_SECTION,
        orderBy: [desc(shareHoldings.id)],
      })
    ).map((share) => ({
      issuedAt: share.issuedAt,
      shareType: share.name,
      numberOfShares: share.numberOfShares,
      sharePriceUsd: share.sharePriceUsd,
      totalAmountInCents: share.totalAmountInCents,
    }));

    return {
      id: investorEntity.externalId,
      name: investorEntity.name,
      grants,
      shares,
    };
  }),
});
