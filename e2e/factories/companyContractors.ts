import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
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
    const userId = overrides.userId || (await usersFactory.create()).user.id;

    const [createdContractor] = await db
      .insert(companyContractors)
      .values({
        companyId,
        userId,
        startedAt: new Date(),
        payRateInSubunits: 6000,
        payRateType: PayRateType.Hourly,
        role: "Role",
        ...overrides,
      })
      .returning();
    assert(createdContractor !== undefined);

    const administrator = await db.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.companyId, companyId),
    });

    if (!options.withoutContract) {
      await documentsFactory.create(
        {
          companyId,
        },
        {
          signed: !options.withUnsignedContract,
          signatures: !options.withUnsignedContract
            ? [
                ...(administrator ? [{ userId: administrator.userId, title: "Company Representative" as const }] : []),
                { userId, title: "Signer" as const },
              ]
            : [],
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
        payRateInSubunits: 6000,
        payRateType: PayRateType.Hourly,
        ...overrides,
      },
      options,
    ),

  createCustom: async (overrides: Partial<typeof companyContractors.$inferInsert> = {}, options: CreateOptions = {}) =>
    companyContractorsFactory.create(
      {
        payRateInSubunits: 100000,
        payRateType: PayRateType.Custom,
        ...overrides,
      },
      options,
    ),
};
