import { getLocalTimeZone, today } from "@internationalized/date";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { dividendComputationOutputs, dividendComputations } from "@/db/schema";
import { assert } from "@/utils/assert";

export const dividendComputationsFactory = {
  // Pre-seed data for dividend computations.
  // This is necessary because dividend computations are generated based on the share class and investor data.
  setupInvestorsWithShareHoldings: async (companyId: bigint) => {
    const { user: investorUser1 } = await usersFactory.create();
    const { user: investorUser2 } = await usersFactory.create();

    const { companyInvestor: investor1 } = await companyInvestorsFactory.create({
      companyId,
      userId: investorUser1.id,
      investmentAmountInCents: 100000n,
    });

    const { companyInvestor: investor2 } = await companyInvestorsFactory.create({
      companyId,
      userId: investorUser2.id,
      investmentAmountInCents: 200000n,
    });

    const { shareClass } = await shareClassesFactory.create({
      companyId,
      name: "Common",
      originalIssuePriceInDollars: "10.00",
    });

    await shareHoldingsFactory.create({
      companyInvestorId: investor1.id,
      shareClassId: shareClass.id,
      numberOfShares: 1000,
      totalAmountInCents: 10000n,
      sharePriceUsd: "10.00",
    });

    await shareHoldingsFactory.create({
      companyInvestorId: investor2.id,
      shareClassId: shareClass.id,
      numberOfShares: 2000,
      totalAmountInCents: 20000n,
      sharePriceUsd: "10.00",
    });

    return { investor1, investor2, shareClass };
  },

  create: async (overrides: Partial<typeof dividendComputations.$inferInsert> = {}) => {
    const companyId =
      overrides.companyId ?? (await companiesFactory.createCompletedOnboarding({ equityEnabled: true })).company.id;
    const { investor1, investor2 } = await dividendComputationsFactory.setupInvestorsWithShareHoldings(companyId);

    const [insertedDividendComputation] = await db
      .insert(dividendComputations)
      .values({
        companyId,
        totalAmountInUsd: "60000.0",
        dividendsIssuanceDate: today(getLocalTimeZone()).add({ days: 15 }).toString(),
        returnOfCapital: false,
        finalizedAt: null,
        ...overrides,
      })
      .returning();
    assert(insertedDividendComputation != null);

    await db.insert(dividendComputationOutputs).values([
      {
        dividendComputationId: insertedDividendComputation.id,
        shareClass: "Common",
        numberOfShares: 1000n,
        preferredDividendAmountInUsd: "0.0",
        dividendAmountInUsd: "20000.0", // 1/3 of 60k based on shares (1000/3000)
        totalAmountInUsd: "20000.0",
        qualifiedDividendAmountUsd: "20000.0",
        companyInvestorId: investor1.id,
        investmentAmountCents: 100000n,
      },
      {
        dividendComputationId: insertedDividendComputation.id,
        shareClass: "Common",
        numberOfShares: 2000n,
        preferredDividendAmountInUsd: "0.0",
        dividendAmountInUsd: "40000.0", // 2/3 of 60k based on shares (2000/3000)
        totalAmountInUsd: "40000.0",
        qualifiedDividendAmountUsd: "40000.0",
        companyInvestorId: investor2.id,
        investmentAmountCents: 200000n,
      },
    ]);

    return insertedDividendComputation;
  },
};
