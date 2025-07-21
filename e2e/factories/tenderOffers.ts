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
        name: overrides.name || `${faker.company.name()} Buyback ${faker.string.alphanumeric(4)}`,
        startsAt,
        endsAt,
        minimumValuation: 100000n,
        buybackType: "tender_offer",
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
};
