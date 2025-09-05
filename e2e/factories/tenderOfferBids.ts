import { db } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { tenderOfferBids } from "@/db/schema";
import { assert } from "@/utils/assert";

export const tenderOfferBidsFactory = {
  create: async (overrides: Partial<typeof tenderOfferBids.$inferInsert> = {}) => {
    const tenderOfferId = overrides.tenderOfferId || (await tenderOffersFactory.createActive()).tenderOffer.id;
    const companyInvestorId =
      overrides.companyInvestorId || (await companyInvestorsFactory.create()).companyInvestor.id;

    const [createdBid] = await db
      .insert(tenderOfferBids)
      .values({
        tenderOfferId,
        companyInvestorId,
        numberOfShares: "100",
        sharePriceCents: 5000,
        shareClass: "Common",
        acceptedShares: "0",
        ...overrides,
      })
      .returning();
    assert(createdBid !== undefined);

    return { bid: createdBid };
  },

  createAccepted: async (overrides: Partial<typeof tenderOfferBids.$inferInsert> = {}) => {
    const acceptedShares = overrides.numberOfShares || "100";
    return tenderOfferBidsFactory.create({
      acceptedShares,
      ...overrides,
    });
  },

  createPartiallyAccepted: async (overrides: Partial<typeof tenderOfferBids.$inferInsert> = {}) => {
    const numberOfShares = overrides.numberOfShares || "100";
    const acceptedShares = String(Math.floor(Number(numberOfShares) / 2));
    return tenderOfferBidsFactory.create({
      numberOfShares,
      acceptedShares,
      ...overrides,
    });
  },

  createRejected: async (overrides: Partial<typeof tenderOfferBids.$inferInsert> = {}) =>
    tenderOfferBidsFactory.create({
      acceptedShares: "0",
      ...overrides,
    }),

  createMultiple: async (
    count: number,
    tenderOfferId: bigint,
    overrides: Partial<typeof tenderOfferBids.$inferInsert> = {},
  ) => {
    const bids = [];
    for (let i = 0; i < count; i++) {
      const bid = await tenderOfferBidsFactory.create({
        tenderOfferId,
        numberOfShares: String(100 + i * 50),
        sharePriceCents: 5000 - i * 100,
        ...overrides,
      });
      bids.push(bid);
    }
    return bids;
  },
};
