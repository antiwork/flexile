import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyRolesFactory } from "@test/factories/companyRoles";
import { contractsFactory } from "@test/factories/contracts";
import { documentsFactory } from "@test/factories/documents";
import { usersFactory } from "@test/factories/users";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { PayRateType } from "@/db/enums";
import { companyAdministrators, companyContractors } from "@/db/schema";
import { assert } from "@/utils/assert";

type CreateOptions = {
  withoutContract?: boolean;
  withUnsignedContract?: boolean;
};

export const companyContractorsFactory = {
  create: async (overrides: Partial<typeof companyContractors.$inferInsert> = {}, options: CreateOptions = {}) => {
    const companyId = overrides.companyId || (await companiesFactory.createCompletedOnboarding()).company.id;
    const companyRoleId = overrides.companyRoleId || (await companyRolesFactory.create({ companyId })).role.id;
    const userId = overrides.userId || (await usersFactory.create()).user.id;

    const [createdContractor] = await db
      .insert(companyContractors)
      .values({
        companyId,
        companyRoleId,
        userId,
        startedAt: new Date(),
        hoursPerWeek: 40,
        payRateInSubunits: 6000,
        payRateType: PayRateType.Hourly,
        onTrial: false,
        ...overrides,
      })
      .returning();
    assert(createdContractor !== undefined);

    const administrator = await db.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.companyId, companyId),
    });

    if (!options.withoutContract) {
      await contractsFactory.create(
        {
          companyContractorId: createdContractor.id,
          ...(administrator ? { companyAdministratorId: administrator.id } : {}),
        },
        {
          signed: !options.withUnsignedContract,
        },
      );

      await documentsFactory.create(
        {
          companyContractorId: createdContractor.id,
          ...(administrator ? { companyAdministratorId: administrator.id } : {}),
          companyId,
          userId,
        },
        {
          signed: !options.withUnsignedContract,
        },
      );
    }

    return { companyContractor: createdContractor };
  },

  createInactive: async (
    overrides: Partial<typeof companyContractors.$inferInsert> = {},
    options: CreateOptions = {},
  ) =>
    companyContractorsFactory.create(
      {
        startedAt: subDays(new Date(), 2),
        endedAt: subDays(new Date(), 1),
        ...overrides,
      },
      options,
    ),

  createHourly: async (overrides: Partial<typeof companyContractors.$inferInsert> = {}, options: CreateOptions = {}) =>
    companyContractorsFactory.create(
      {
        hoursPerWeek: 40,
        payRateInSubunits: 6000,
        payRateType: PayRateType.Hourly,
        ...overrides,
      },
      options,
    ),

  createProjectBased: async (
    overrides: Partial<typeof companyContractors.$inferInsert> = {},
    options: CreateOptions = {},
  ) => {
    const { role } = await companyRolesFactory.createProjectBased();
    return companyContractorsFactory.create(
      {
        companyRoleId: role.id,
        hoursPerWeek: null,
        payRateInSubunits: 100000,
        payRateType: PayRateType.ProjectBased,
        ...overrides,
      },
      options,
    );
  },
};
