import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyStripeAccounts } from "@/db/schema";

export const companyStripeAccountsFactory = {
  create: async (overrides: Partial<typeof companyStripeAccounts.$inferInsert> = {}) => {
    const insertedStripeAccount = await db
      .insert(companyStripeAccounts)
      .values({
        companyId: overrides.companyId || (await companiesFactory.create()).company.id,
        status: "ready",
        setupIntentId: "seti_1LS2aCFSsGLfTpetJF5ZbTzr",
        bankAccountLastFour: "4242",
        ...overrides,
      })
      .returning();

    return { stripeAccount: insertedStripeAccount[0] };
  },
};
