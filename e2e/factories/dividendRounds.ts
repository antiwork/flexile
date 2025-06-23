import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { dividendRounds } from "@/db/schema";
import { assert } from "@/utils/assert";

export const dividendRoundsFactory = {
  create: async (overrides: Partial<typeof dividendRounds.$inferInsert> = {}) => {
    const [insertedDividendRound] = await db
      .insert(dividendRounds)
      .values({
        companyId: overrides.companyId ?? (await companiesFactory.create()).company.id,
        issuedAt: faker.date.recent(),
        numberOfShares: 1000n,
        numberOfShareholders: 10n,
        totalAmountInCents: 100000n,
        status: "Issued",
        returnOfCapital: false,
        readyForPayment: true,
        releaseDocument: "This is a release agreement for {{investor}} for the amount of {{amount}}.",
        ...overrides,
      })
      .returning();
    assert(insertedDividendRound != null);

    return insertedDividendRound;
  },
};
