import { db, takeOrThrow } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { eq } from "drizzle-orm";
import { userComplianceInfos, users } from "@/db/schema";
import { assert } from "@/utils/assert";

const NON_TAX_COMPLIANCE_ATTRIBUTES = [
  "legalName",
  "birthDate",
  "countryCode",
  "citizenshipCountryCode",
  "streetAddress",
  "city",
  "state",
  "zipCode",
] as const;

export const userComplianceInfosFactory = {
  create: async (overrides: Partial<typeof userComplianceInfos.$inferInsert> = {}) => {
    const user = overrides.userId
      ? await db.query.users.findFirst({ where: eq(users.id, overrides.userId) }).then(takeOrThrow)
      : (await usersFactory.create()).user;

    const nonTaxComplianceAttributeDefaultValues = Object.fromEntries(
      NON_TAX_COMPLIANCE_ATTRIBUTES.map((attr) => [attr, user[attr]]),
    );

    const [userComplianceInfo] = await db
      .insert(userComplianceInfos)
      .values({
        userId: user.id,
        taxId: "000-00-0000",
        ...nonTaxComplianceAttributeDefaultValues,
        ...overrides,
      })
      .returning();
    assert(userComplianceInfo != null);

    return { userComplianceInfo };
  },

  createUsResident: async (overrides: Partial<typeof userComplianceInfos.$inferInsert> = {}) =>
    userComplianceInfosFactory.create({
      countryCode: "US",
      citizenshipCountryCode: "US",
      streetAddress: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      ...overrides,
    }),

  createNonUsResident: async (overrides: Partial<typeof userComplianceInfos.$inferInsert> = {}) =>
    userComplianceInfosFactory.create({
      countryCode: "FR",
      citizenshipCountryCode: "FR",
      streetAddress: "1st Street",
      city: "Paris",
      state: "75C",
      zipCode: "75001",
      ...overrides,
    }),

  createVerified: async (overrides: Partial<typeof userComplianceInfos.$inferInsert> = {}) =>
    userComplianceInfosFactory.create({
      taxIdStatus: "verified",
      ...overrides,
    }),

  createConfirmed: async (overrides: Partial<typeof userComplianceInfos.$inferInsert> = {}) =>
    userComplianceInfosFactory.create({
      taxInformationConfirmedAt: new Date(),
      ...overrides,
    }),
};
