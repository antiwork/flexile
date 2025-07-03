import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { invoicesFactory } from "@test/factories/invoices";
import { eq } from "drizzle-orm";
import { companyContractors, invoiceLineItems, invoices } from "@/db/schema";
import { assert } from "@/utils/assert";

export const invoiceLineItemsFactory = {
  create: async (overrides: Partial<typeof invoiceLineItems.$inferInsert> = {}) => {
    const invoice = overrides.invoiceId
      ? await db.query.invoices.findFirst({
          where: eq(invoices.id, overrides.invoiceId),
        })
      : (await invoicesFactory.create()).invoice;
    assert(invoice !== undefined);

    const contractor = await db.query.companyContractors.findFirst({
      where: eq(companyContractors.id, invoice.companyContractorId),
    });
    assert(contractor !== undefined);

    const [lineItem] = await db
      .insert(invoiceLineItems)
      .values({
        invoiceId: invoice.id,
        description: faker.company.buzzPhrase(),
        payRateInSubunits: contractor.payRateInSubunits ?? 1000,
        payRateCurrency: contractor.payRateCurrency,
        quantity: 1,
        ...overrides,
      })
      .returning();
    assert(lineItem != null);

    return { lineItem };
  },
};
