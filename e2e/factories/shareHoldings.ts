import { companyInvestors, shareClasses, shareHoldings } from "@/db/schema";
import { assert } from "@/utils/assert";
import { db, takeOrThrow } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { eq } from "drizzle-orm";

export const shareHoldingsFactory = {
  create: async (overrides: Partial<typeof shareHoldings.$inferInsert> = {}) => {
    const investor = overrides.companyInvestorId
      ? await db.query.companyInvestors
          .findFirst({ where: eq(companyInvestors.id, overrides.companyInvestorId) })
          .then(takeOrThrow)
      : (await companyInvestorsFactory.create(overrides)).companyInvestor;
    const shareClass = overrides.shareClassId
      ? await db.query.shareClasses.findFirst({ where: eq(shareClasses.id, overrides.shareClassId) }).then(takeOrThrow)
      : (await shareClassesFactory.create({ companyId: investor.companyId })).shareClass;
    const [shareHolding] = await db
      .insert(shareHoldings)
      .values({
        companyInvestorId: investor.id,
        shareClassId: shareClass.id,
        name: `C2-1`,
        numberOfShares: 100,
        issuedAt: new Date(),
        originallyAcquiredAt: new Date(),
        totalAmountInCents: BigInt(10000),
        sharePriceUsd: "10.00",
        shareHolderName: "Test Holder",
        ...overrides,
      })
      .returning();
    assert(shareHolding != null);
    return shareHolding;
  },
};
