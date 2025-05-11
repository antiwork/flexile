import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { userComplianceInfosFactory } from "@test/factories/userComplianceInfos";
import bcrypt from "bcrypt";
import { users } from "@/db/schema";
import { assert } from "@/utils/assert";

export const usersFactory = {
  create: async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const [user] = await db
      .insert(users)
      .values({
        email: faker.internet.email().toLowerCase(),
        legalName: faker.person.fullName(),
        preferredName: faker.person.firstName(),
        encryptedPassword: await bcrypt.hash("password", 10),
        confirmedAt: new Date(),
        invitationAcceptedAt: new Date(),
        currentSignInIp: faker.internet.ipv4(),
        lastSignInIp: faker.internet.ipv4(),
        streetAddress: "1st Street",
        city: "New York",
        state: "NY",
        countryCode: "US",
        citizenshipCountryCode: "US",
        zipCode: "10004",
        birthDate: new Date("1980-07-15").toISOString(),
        minimumDividendPaymentInCents: 1000n,
        invitedByType: overrides.invitedById ? "User" : null,
        ...overrides,
      })
      .returning();
    assert(user != null);

    return { user };
  },

  createWithBusinessEntity: async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const { user } = await usersFactory.create(overrides);
    await userComplianceInfosFactory.create({ userId: user.id, businessEntity: true, businessName: "Business Inc." });
    return { user };
  },

  createPreOnboarding: async (overrides: Partial<typeof users.$inferInsert> = {}) =>
    usersFactory.create({
      preferredName: null,
      legalName: null,
      countryCode: null,
      citizenshipCountryCode: null,
      ...overrides,
    }),

  createContractor: async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const { user } = await usersFactory.create(overrides);
    await companyContractorsFactory.create({ userId: user.id });
    return { user };
  },

  createCompanyAdmin: async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const { user } = await usersFactory.create(overrides);
    await companyAdministratorsFactory.create({ userId: user.id });
    return { user };
  },

  createInvestor: async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const { user } = await usersFactory.create(overrides);
    await companyInvestorsFactory.create({ userId: user.id });
    return { user };
  },

  createCompanyLawyer: async (overrides: Partial<typeof users.$inferInsert> = {}) => {
    const { user } = await usersFactory.create(overrides);
    await companyLawyersFactory.create({ userId: user.id });
    return { user };
  },
};
