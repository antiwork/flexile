import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sum } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { companyInvestors, convertibleInvestments, convertibleSecurities } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { assertDefined } from "@/utils/assert";

export const convertibleSecuritiesRouter = createRouter({
  list: companyProcedure.input(z.object({ investorId: z.string() })).query(async ({ input, ctx }) => {
    if (
      !ctx.companyAdministrator &&
      !ctx.companyLawyer &&
      !(ctx.companyInvestor && ctx.companyInvestor.externalId === input.investorId)
    )
      throw new TRPCError({ code: "FORBIDDEN" });

    const where = and(
      eq(companyInvestors.companyId, ctx.company.id),
      eq(companyInvestors.externalId, input.investorId),
    );
    const query = db
      .select({
        ...pick(convertibleSecurities, "issuedAt", "principalValueInCents"),
        ...pick(convertibleInvestments, "convertibleType", "companyValuationInDollars"),
      })
      .from(convertibleSecurities)
      .innerJoin(companyInvestors, eq(convertibleSecurities.companyInvestorId, companyInvestors.id))
      .innerJoin(convertibleInvestments, eq(convertibleSecurities.convertibleInvestmentId, convertibleInvestments.id))
      .where(where)
      .orderBy(desc(convertibleSecurities.issuedAt));

    const [totals] = await db
      .select({
        totalImpliedShares: sum(convertibleSecurities.impliedShares).mapWith(Number),
        totalPrincipalValueInCents: sum(convertibleSecurities.principalValueInCents).mapWith(Number),
        totalCount: count(),
      })
      .from(convertibleSecurities)
      .innerJoin(companyInvestors, eq(convertibleSecurities.companyInvestorId, companyInvestors.id))
      .innerJoin(convertibleInvestments, eq(convertibleSecurities.convertibleInvestmentId, convertibleInvestments.id))
      .where(where);

    return { convertibleSecurities: await query, ...assertDefined(totals) };
  }),
});
