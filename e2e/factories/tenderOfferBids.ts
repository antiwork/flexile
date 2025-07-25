import { db, takeOrThrow } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { eq } from "drizzle-orm";
import { companyInvestors, tenderOfferBids, tenderOffers } from "@/db/schema";
import { assert } from "@/utils/assert";

export const tenderOfferBidsFactory = {
  create: async (overrides: Partial<typeof tenderOfferBids.$inferInsert> = {}) => {
    const tenderOffer = overrides.tenderOfferId
      ? await db.query.tenderOffers.findFirst({ where: eq(tenderOffers.id, overrides.tenderOfferId) }).then(takeOrThrow)
      : (await tenderOffersFactory.create()).tenderOffer;

    const companyInvestor = overrides.companyInvestorId
      ? await db.query.companyInvestors
          .findFirst({ where: eq(companyInvestors.id, overrides.companyInvestorId) })
          .then(takeOrThrow)
      : (await companyInvestorsFactory.create({ companyId: tenderOffer.companyId })).companyInvestor;

    const shareClass =
      overrides.shareClass || (await shareClassesFactory.create({ companyId: tenderOffer.companyId })).shareClass.name;

    const [createdTenderOfferBid] = await db
      .insert(tenderOfferBids)
      .values({
        tenderOfferId: tenderOffer.id,
        companyInvestorId: companyInvestor.id,
        numberOfShares: "10",
        sharePriceCents: 1500,
        shareClass,
        acceptedShares: "0",
        ...overrides,
      })
      .returning();
    assert(createdTenderOfferBid !== undefined);

    return { tenderOfferBid: createdTenderOfferBid };
  },
};
