import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { usersFactory } from "@test/factories/users";
import { companies } from "@/db/schema";
import { assert } from "@/utils/assert";

type CreateOptions = {
  withoutBankAccount: boolean;
};

export const companiesFactory = {
  create: async (
    overrides: Partial<typeof companies.$inferInsert> = {},
    options: CreateOptions = { withoutBankAccount: false },
  ) => {
    const [insertedCompany] = await db
      .insert(companies)
      .values({
        name: faker.company.name(),
        email: faker.internet.email(),
        registrationNumber: faker.string.numeric(9),
        registrationState: "DE",
        streetAddress: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode(),
        countryCode: "US",
        stripeCustomerId: "cus_M2QFeoOFttyzTx",
        brandColor: faker.color.rgb({ prefix: "#" }),
        website: "https://www.example.com",
        requiredInvoiceApprovalCount: 2,
        fullyDilutedShares: 1000000n,
        valuationInDollars: 2000000n,
        sharePriceInUsd: "100",
        fmvPerShareInUsd: "40",
        ...overrides,
      })
      .returning();
    assert(insertedCompany != null);

    if (!options.withoutBankAccount && !overrides.stripeCustomerId) {
      await companyStripeAccountsFactory.create({ companyId: insertedCompany.id });
    }

    return { company: insertedCompany };
  },

  createPreOnboarding: async (
    overrides: Partial<typeof companies.$inferInsert> = {},
    options: CreateOptions = { withoutBankAccount: true },
  ) =>
    companiesFactory.create(
      {
        name: null,
        streetAddress: null,
        city: null,
        state: null,
        zipCode: null,
        stripeCustomerId: null,
        ...overrides,
      },
      options,
    ),

  createCompletedOnboarding: async (
    overrides: Partial<typeof companies.$inferInsert> = {},
    options: CreateOptions = { withoutBankAccount: false },
  ) => {
    const company = (await companiesFactory.create(overrides, options)).company;
    const adminUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });
    return { company, adminUser };
  },
};
