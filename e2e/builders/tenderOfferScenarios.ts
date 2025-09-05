import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { tenderOfferBidsFactory } from "@test/factories/tenderOfferBids";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { usersFactory } from "@test/factories/users";
import type { companies, tenderOffers, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

export interface TenderOfferScenario {
  company: typeof companies.$inferSelect;
  adminUser: typeof users.$inferSelect;
  investorUsers: (typeof users.$inferSelect)[];
  tenderOffer: typeof tenderOffers.$inferSelect;
}

export const tenderOfferScenarioBuilder = {
  createBasicScenario: async (): Promise<TenderOfferScenario> => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { tenderOffer } = await tenderOffersFactory.createActive({
      companyId: company.id,
      minimumValuation: 10000000n,
    });

    const investorUsers: (typeof users.$inferSelect)[] = [];

    for (let i = 0; i < 3; i++) {
      const { user } = await usersFactory.create();
      const { companyInvestor } = await companyInvestorsFactory.create({
        companyId: company.id,
        userId: user.id,
      });

      await shareHoldingsFactory.create({
        companyInvestorId: companyInvestor.id,
        shareClassId: (await shareClassesFactory.create({ companyId: company.id, name: "Common" })).shareClass.id,
        numberOfShares: 1000 * (i + 1),
      });

      investorUsers.push(user);
    }

    return { company, adminUser, investorUsers, tenderOffer };
  },

  createScenarioWithExistingBids: async () => {
    const scenario = await tenderOfferScenarioBuilder.createBasicScenario();

    for (let i = 0; i < scenario.investorUsers.length; i++) {
      const investor = await db.query.companyInvestors.findFirst({
        where: (ci, { and, eq }) =>
          and(eq(ci.companyId, scenario.company.id), eq(ci.userId, assertDefined(scenario.investorUsers[i]).id)),
      });

      if (investor) {
        await tenderOfferBidsFactory.create({
          tenderOfferId: scenario.tenderOffer.id,
          companyInvestorId: investor.id,
          numberOfShares: String(100 * (i + 1)),
          sharePriceCents: 5000 - i * 500,
        });
      }
    }

    return scenario;
  },

  createScenarioWithMultipleShareClasses: async () => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const commonShareClass = await shareClassesFactory.create({
      companyId: company.id,
      name: "Common",
    });

    const preferredShareClass = await shareClassesFactory.create({
      companyId: company.id,
      name: "Preferred",
    });

    const { tenderOffer } = await tenderOffersFactory.createActive({
      companyId: company.id,
    });

    const investorUsers: (typeof users.$inferSelect)[] = [];
    const shareClasses = [commonShareClass.shareClass, preferredShareClass.shareClass];

    for (let i = 0; i < 4; i++) {
      const { user } = await usersFactory.create();
      const { companyInvestor } = await companyInvestorsFactory.create({
        companyId: company.id,
        userId: user.id,
      });

      await shareHoldingsFactory.create({
        companyInvestorId: companyInvestor.id,
        shareClassId: assertDefined(shareClasses[i % 2]).id,
        numberOfShares: 1000 * (i + 1),
      });

      investorUsers.push(user);
    }

    return { company, adminUser, investorUsers, tenderOffer };
  },

  createExpiredTenderOfferScenario: async () => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { tenderOffer } = await tenderOffersFactory.createExpired({
      companyId: company.id,
    });

    const { user: investorUser } = await usersFactory.create();
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorUser.id,
    });

    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      shareClassId: (await shareClassesFactory.create({ companyId: company.id, name: "Common" })).shareClass.id,
      numberOfShares: 1000,
    });

    return { company, adminUser, investorUsers: [investorUser], tenderOffer };
  },

  createCompletedTenderOfferScenario: async () => {
    const scenario = await tenderOfferScenarioBuilder.createBasicScenario();

    const { tenderOffer } = await tenderOffersFactory.createExpired({
      companyId: scenario.company.id,
      acceptedPriceCents: 4500,
      numberOfShares: 500n,
      numberOfShareholders: 2,
      totalAmountInCents: 2250000n,
    });

    for (let i = 0; i < 2; i++) {
      const investor = await db.query.companyInvestors.findFirst({
        where: (ci, { and, eq }) =>
          and(eq(ci.companyId, scenario.company.id), eq(ci.userId, assertDefined(scenario.investorUsers[i]).id)),
      });

      if (investor) {
        await tenderOfferBidsFactory.createAccepted({
          tenderOfferId: tenderOffer.id,
          companyInvestorId: investor.id,
          numberOfShares: String(250),
          sharePriceCents: 4500,
          acceptedShares: String(250),
        });
      }
    }

    return { ...scenario, tenderOffer };
  },
};
