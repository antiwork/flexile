import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { companyGithubConnections } from "@/db/schema";
import { assert } from "@/utils/assert";

export const companyGithubConnectionsFactory = {
  create: async (overrides: Partial<typeof companyGithubConnections.$inferInsert> = {}) => {
    const companyId = overrides.companyId || (await companiesFactory.createCompletedOnboarding()).company.id;
    const connectedById = overrides.connectedById || (await usersFactory.create()).user.id;

    const [createdConnection] = await db
      .insert(companyGithubConnections)
      .values({
        companyId,
        connectedById,
        githubOrgId: faker.string.numeric(7),
        githubOrgLogin: faker.company.buzzPhrase().replace(/ /gu, "-").toLowerCase(),
        installationId: faker.string.numeric(5),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      })
      .returning();
    assert(createdConnection !== undefined);

    return { companyGithubConnection: createdConnection };
  },
};
