import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";

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
  },
};
