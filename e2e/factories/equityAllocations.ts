import { db } from "@test/db";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { equityAllocations } from "@/db/schema";
import { assert } from "@/utils/assert";

export const equityAllocationsFactory = {
  create: async (overrides: Partial<typeof equityAllocations.$inferInsert> = {}) => {
    const [equityAllocation] = await db
      .insert(equityAllocations)
      .values({
        companyContractorId:
          overrides.companyContractorId || (await companyContractorsFactory.create()).companyContractor.id,
        year: overrides.year || new Date().getFullYear(),
        equityPercentage: overrides.equityPercentage || 0,
        locked: overrides.locked || false,
        status: overrides.status || "pending_confirmation",
        ...overrides,
      })
      .returning();
    assert(equityAllocation != null);

    return { equityAllocation };
  },

  createLocked: async (overrides = {}) =>
    equityAllocationsFactory.create({
      locked: true,
      status: "approved",
      ...overrides,
    }),
};
