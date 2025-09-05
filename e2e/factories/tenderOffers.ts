import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { addDays, subDays } from "date-fns";
import { activeStorageAttachments, activeStorageBlobs, tenderOffers } from "@/db/schema";
import { assert } from "@/utils/assert";

export const tenderOffersFactory = {
  create: async (overrides: Partial<typeof tenderOffers.$inferInsert> = {}) => {
    const companyId = overrides.companyId || (await companiesFactory.create()).company.id;

    const startsAt = overrides.startsAt || subDays(new Date(), 5);
    const endsAt = overrides.endsAt || addDays(new Date(), 1);

    const [createdTenderOffer] = await db
      .insert(tenderOffers)
      .values({
        companyId,
        startsAt,
        endsAt,
        minimumValuation: 100000n,
        letterOfTransmittal: overrides.letterOfTransmittal || faker.lorem.paragraph(),
        ...overrides,
      })
      .returning();
    assert(createdTenderOffer !== undefined);

    const [blob] = await db
      .insert(activeStorageBlobs)
      .values({
        key: `${createdTenderOffer.externalId}-tender-offer-attachment`,
        filename: "attachment.zip",
        serviceName: "test",
        byteSize: 100n,
        contentType: "application/zip",
      })
      .returning();
    assert(blob !== undefined);

    await db.insert(activeStorageAttachments).values({
      recordId: createdTenderOffer.id,
      recordType: "TenderOffer",
      blobId: blob.id,
      name: "attachment",
    });

    return { tenderOffer: createdTenderOffer };
  },

  createActive: async (overrides: Partial<typeof tenderOffers.$inferInsert> = {}) =>
    tenderOffersFactory.create({
      startsAt: subDays(new Date(), 1),
      endsAt: addDays(new Date(), 7),
      ...overrides,
    }),

  createExpired: async (overrides: Partial<typeof tenderOffers.$inferInsert> = {}) =>
    tenderOffersFactory.create({
      startsAt: subDays(new Date(), 30),
      endsAt: subDays(new Date(), 1),
      ...overrides,
    }),

  createUpcoming: async (overrides: Partial<typeof tenderOffers.$inferInsert> = {}) =>
    tenderOffersFactory.create({
      startsAt: addDays(new Date(), 1),
      endsAt: addDays(new Date(), 30),
      ...overrides,
    }),

  createWithAcceptedPrice: async (overrides: Partial<typeof tenderOffers.$inferInsert> = {}) =>
    tenderOffersFactory.create({
      acceptedPriceCents: 4500,
      numberOfShares: 10000n,
      numberOfShareholders: 5,
      totalAmountInCents: 45000000n,
      ...overrides,
    }),
};
