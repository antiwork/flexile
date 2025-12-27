import { db } from "@test/db";
import { integrations } from "@/db/schema";
import { assert } from "@/utils/assert";

export const integrationsFactory = {
  create: async (overrides: Partial<typeof integrations.$inferInsert> = {}) => {
    const [insertedIntegration] = await db
      .insert(integrations)
      .values({
        companyId: 0n, // Must be overridden
        type: "github",
        status: "active",
        accountId: "test-org",
        ...overrides,
      })
      .returning();
    assert(insertedIntegration != null);

    return { integration: insertedIntegration };
  },

  createGitHubIntegration: async (companyId: bigint, organizationName: string) =>
    integrationsFactory.create({
      companyId,
      type: "github",
      status: "active",
      accountId: organizationName,
    }),
};
