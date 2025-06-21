import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { companyInvestors } from "@/db/schema";
import { assert } from "@/utils/assert";

export const companyInvestorsFactory = {
  create: async (overrides: Partial<typeof companyInvestors.$inferInsert> = {}) => {
    const companyId = overrides.companyId || (await companiesFactory.create()).company.id;
    const userId = overrides.userId || (await usersFactory.create()).user.id;

    const [createdInvestor] = await db
      .insert(companyInvestors)
      .values({
        companyId,
        userId,
        investmentAmountInCents: BigInt(0),
        ...overrides,
      })
      .returning();
    assert(createdInvestor !== undefined);

    return { companyInvestor: createdInvestor };
  },
};
