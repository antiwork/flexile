import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { convertibleInvestments } from "@/db/schema";
import { assert } from "@/utils/assert";

export const convertibleInvestmentsFactory = {
  create: async (overrides: Partial<typeof convertibleInvestments.$inferInsert> = {}) => {
    const companyId = overrides.companyId || (await companiesFactory.create()).company.id;
    const [createdInvestment] = await db
      .insert(convertibleInvestments)
      .values({
        identifier: overrides.identifier || `GUM-SAFE${Math.floor(Math.random() * 10000)}`,
        entityName: overrides.entityName || faker.company.name(),
        companyId,
        companyValuationInDollars: overrides.companyValuationInDollars || 100_000_000n,
        amountInCents: overrides.amountInCents || 1_000_000_00n,
        impliedShares: overrides.impliedShares || 45_123n,
        valuationType: overrides.valuationType || "Pre-money",
        convertibleType: overrides.convertibleType || "Crowd SAFE",
        issuedAt: overrides.issuedAt || new Date(),
        ...overrides,
      })
      .returning();
    assert(createdInvestment != null);
    return { convertibleInvestment: createdInvestment };
  },
};
