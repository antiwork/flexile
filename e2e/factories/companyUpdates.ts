import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companyUpdates } from "@/db/schema";
import { assert } from "@/utils/assert";

export const companyUpdatesFactory = {
  create: async (overrides: Partial<typeof companyUpdates.$inferInsert> = {}) => {
    const [insertedUpdate] = await db
      .insert(companyUpdates)
      .values({
        companyId: BigInt(faker.number.int({ min: 1, max: 1000 })),
        title: faker.lorem.sentence(),
        body: `<p>${faker.lorem.paragraphs(2, "<br/>")}</p>`,
        videoUrl: null,
        sentAt: null,
        ...overrides,
      })
      .returning();
    assert(insertedUpdate != null);

    return { companyUpdate: insertedUpdate };
  },

  createWithYouTubeVideo: async (videoUrl: string, overrides: Partial<typeof companyUpdates.$inferInsert> = {}) =>
    companyUpdatesFactory.create({
      videoUrl,
      ...overrides,
    }),

  createPublished: async (overrides: Partial<typeof companyUpdates.$inferInsert> = {}) =>
    companyUpdatesFactory.create({
      sentAt: new Date(),
      ...overrides,
    }),
};
