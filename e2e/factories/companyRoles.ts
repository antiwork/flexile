import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { PayRateType } from "@/db/enums";
import { companyRoleRates, companyRoles } from "@/db/schema";
import { assert } from "@/utils/assert";

export const companyRolesFactory = {
  create: async (
    overrides: Partial<typeof companyRoles.$inferInsert> = {},
    rateOverrides: Partial<typeof companyRoleRates.$inferInsert> = {},
  ) => {
    const [role] = await db
      .insert(companyRoles)
      .values({
        companyId: overrides.companyId || (await companiesFactory.create()).company.id,
        name: faker.person.jobTitle(),
        jobDescription: "", // Empty string but still required by schema
        capitalizedExpense: faker.number.int({ min: 0, max: 80 }),
        ...overrides,
      })
      .returning();
    assert(role != null);

    const [rate] = await db
      .insert(companyRoleRates)
      .values({
        companyRoleId: role.id,
        payRateInSubunits: faker.number.int({ min: 10000, max: 20000 }),
        payRateType: PayRateType.Hourly,
        ...rateOverrides,
      })
      .returning();

    return { role, rate };
  },

  createProjectBased: async (
    overrides: Partial<typeof companyRoles.$inferInsert> = {},
    rateOverrides: Partial<typeof companyRoleRates.$inferInsert> = {},
  ) =>
    companyRolesFactory.create(
      { name: "Project-based Engineer", ...overrides },
      { payRateType: PayRateType.ProjectBased, ...rateOverrides },
    ),

  createSalaried: async (
    overrides: Partial<typeof companyRoles.$inferInsert> = {},
    rateOverrides: Partial<typeof companyRoleRates.$inferInsert> = {},
  ) =>
    companyRolesFactory.create(
      { name: "Salaried Engineer", ...overrides },
      { payRateType: PayRateType.Salary, ...rateOverrides },
    ),
};
