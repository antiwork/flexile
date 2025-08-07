import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { optionPools } from "@/db/schema";
import { assert } from "@/utils/assert";

export const optionPoolsFactory = {
  create: async (overrides: Partial<typeof optionPools.$inferInsert> = {}) => {
    const [optionPool] = await db
      .insert(optionPools)
      .values({
        companyId: overrides.companyId || (await companiesFactory.create()).company.id,
        shareClassId: overrides.shareClassId || (await shareClassesFactory.create()).shareClass.id,
        name: overrides.name || "Best equity plan",
        authorizedShares: overrides.authorizedShares || 10000n,
        issuedShares: overrides.issuedShares || 50n,
        ...overrides,
      })
      .returning();
    assert(optionPool != null);

    return { optionPool };
  },
};
