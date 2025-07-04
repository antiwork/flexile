import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendRoundsFactory } from "@test/factories/dividendRounds";
import { dividends } from "@/db/schema";
import { assert } from "@/utils/assert";

export const dividendsFactory = {
  create: async (overrides: Partial<typeof dividends.$inferInsert> = {}) => {
    const company = overrides.companyId ? { id: overrides.companyId } : (await companiesFactory.create()).company;

    const companyInvestorResult = overrides.companyInvestorId
      ? { companyInvestor: { id: overrides.companyInvestorId } }
      : await companyInvestorsFactory.create({ companyId: company.id });

    const dividendRound = overrides.dividendRoundId
      ? { id: overrides.dividendRoundId }
      : await dividendRoundsFactory.create({ companyId: company.id });

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
        qualifiedAmountCents: 0n,
        ...overrides,
      })
      .returning();
    assert(insertedDividend != null);

    return insertedDividend;
  },
};
