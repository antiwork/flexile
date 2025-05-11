import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companyContractorUpdatesFactory } from "@test/factories/companyContractorUpdates";
import { companyContractorUpdateTasks } from "@/db/schema";
import { assert } from "@/utils/assert";

export const companyContractorUpdateTasksFactory = {
  create: async (overrides: Partial<typeof companyContractorUpdateTasks.$inferInsert> = {}) => {
    const [updateTask] = await db
      .insert(companyContractorUpdateTasks)
      .values({
        name: faker.person.jobTitle(),
        companyContractorUpdateId:
          overrides.companyContractorUpdateId || (await companyContractorUpdatesFactory.create()).id,
        position: 0,
        ...overrides,
      })
      .returning();
    assert(updateTask != null);

    return updateTask;
  },
  createCompleted: async (overrides: Partial<typeof companyContractorUpdateTasks.$inferInsert> = {}) =>
    companyContractorUpdateTasksFactory.create({
      completedAt: new Date(),
      ...overrides,
    }),
};
