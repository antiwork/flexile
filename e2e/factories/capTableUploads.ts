import assert from "node:assert";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { capTableUploads } from "@/db/schema";

export const capTableUploadsFactory = {
  create: async (overrides: Partial<typeof capTableUploads.$inferInsert> = {}) => {
    const [insertedUpload] = await db
      .insert(capTableUploads)
      .values({
        companyId: overrides.companyId || (await companiesFactory.create()).company.id,
        userId: overrides.userId || (await usersFactory.create()).user.id,
        uploadedAt: new Date(),
        status: overrides.status || "submitted",
        ...overrides,
      })
      .returning();
    assert(insertedUpload != null);

    return insertedUpload;
  },
};
