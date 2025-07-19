import { db } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { convertibleInvestmentsFactory } from "@test/factories/convertibleInvestments";
import { convertibleSecurities } from "@/db/schema";
import { assert } from "@/utils/assert";

export const convertibleSecuritiesFactory = {
  create: async (overrides: Partial<typeof convertibleSecurities.$inferInsert> = {}) => {
    const companyInvestorId =
      overrides.companyInvestorId || (await companyInvestorsFactory.create()).companyInvestor.id;
    const convertibleInvestmentId =
      overrides.convertibleInvestmentId || (await convertibleInvestmentsFactory.create()).convertibleInvestment.id;
    const [createdSecurity] = await db
      .insert(convertibleSecurities)
      .values({
        companyInvestorId,
        convertibleInvestmentId,
        principalValueInCents: overrides.principalValueInCents || 1_000_000_00n,
        impliedShares: overrides.impliedShares || "25123",
        issuedAt: overrides.issuedAt || new Date(),
        ...overrides,
      })
      .returning();
    assert(createdSecurity != null);
    return { convertibleSecurity: createdSecurity };
  },
};
