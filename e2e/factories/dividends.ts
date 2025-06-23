import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendRoundsFactory } from "@test/factories/dividendRounds";
import { userComplianceInfosFactory } from "@test/factories/userComplianceInfos";
import { dividends } from "@/db/schema";
import { assert } from "@/utils/assert";

export const dividendsFactory = {
  create: async (overrides: Partial<typeof dividends.$inferInsert> = {}) => {
    const company = overrides.companyId ? { id: overrides.companyId } : (await companiesFactory.create()).company;

    const companyInvestorResult = overrides.companyInvestorId
      ? { companyInvestor: { id: overrides.companyInvestorId, userId: 0n } }
      : await companyInvestorsFactory.create({ companyId: company.id });

    const dividendRound = overrides.dividendRoundId
      ? { id: overrides.dividendRoundId }
      : (await dividendRoundsFactory.create({ companyId: company.id })).dividendRound;

    const userComplianceInfo = overrides.userComplianceInfoId
      ? { id: overrides.userComplianceInfoId }
      : (await userComplianceInfosFactory.create({ userId: companyInvestorResult.companyInvestor.userId }))
          .userComplianceInfo;

    const [insertedDividend] = await db
      .insert(dividends)
      .values({
        companyId: company.id,
        dividendRoundId: dividendRound.id,
        companyInvestorId: companyInvestorResult.companyInvestor.id,
        totalAmountInCents: 10000n,
        numberOfShares: 100n,
        status: "Issued",
        withheldTaxCents: 0n,
        netAmountInCents: 10000n,
        withholdingPercentage: 0,
        userComplianceInfoId: userComplianceInfo.id,
        qualifiedAmountCents: 0n,
        ...overrides,
      })
      .returning();
    assert(insertedDividend != null);

    return { dividend: insertedDividend };
  },
};
