import { db } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { tenderOfferInvestors } from "@/db/schema";
import { assert } from "@/utils/assert";

export const tenderOfferInvestorsFactory = {
  create: async (overrides: Partial<typeof tenderOfferInvestors.$inferInsert> = {}) => {
    const tenderOfferId = overrides.tenderOfferId || (await tenderOffersFactory.create()).tenderOffer.id;
    const companyInvestorId =
      overrides.companyInvestorId || (await companyInvestorsFactory.create()).companyInvestor.id;

    const [createdTenderOfferInvestor] = await db
      .insert(tenderOfferInvestors)
      .values({
        tenderOfferId,
        companyInvestorId,
        ...overrides,
      })
      .returning();
    assert(createdTenderOfferInvestor !== undefined);

    return { tenderOfferInvestor: createdTenderOfferInvestor };
  },
};
