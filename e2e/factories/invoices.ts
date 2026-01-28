import { db } from "@test/db";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoiceLineItemsFactory } from "@test/factories/invoiceLineItems";
import { format, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { companies, companyContractors, invoiceLineItems, invoices, users } from "@/db/schema";
import { assert } from "@/utils/assert";

const BASE_FLEXILE_FEE_CENTS = 50;
const MAX_FLEXILE_FEE_CENTS = 15_00;
const PERCENT_FLEXILE_FEE = 1.5;
const calculateFlexileFeeCents = (totalAmountInUsdCents: number) => {
  const feeCents = BASE_FLEXILE_FEE_CENTS + (totalAmountInUsdCents * PERCENT_FLEXILE_FEE) / 100;
  return Math.min(feeCents, MAX_FLEXILE_FEE_CENTS);
};

export const invoicesFactory = {
  create: async (
    overrides: Partial<typeof invoices.$inferInsert> = {},
    options: { lineItems?: Partial<typeof invoiceLineItems.$inferInsert>[] } = {},
  ) => {
    const contractor = overrides.companyContractorId
      ? await db.query.companyContractors.findFirst({
          where: eq(companyContractors.id, overrides.companyContractorId),
        })
      : (
          await companyContractorsFactory.create({
            ...(overrides.companyId ? { companyId: overrides.companyId } : {}),
            ...(overrides.userId ? { userId: overrides.userId } : {}),
          })
        ).companyContractor;
    assert(contractor !== undefined);

    const user = await db.query.users.findFirst({
      where: eq(users.id, contractor.userId),
    });
    assert(user != null, "User is required");
    if (overrides.userId !== undefined) {
      assert(
        overrides.userId === user.id,
        "The userId passed to the invoicesFactory is not compatible with the contractor",
      );
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, contractor.companyId),
    });
    assert(company != null, "Company is required");
    if (overrides.companyId !== undefined) {
      assert(
        overrides.companyId === company.id,
        "The companyId passed to the invoicesFactory is not compatible with the contractor",
      );
    }

    const invoiceDate = format(subDays(new Date(), 3), "yyyy-MM-dd");

    const cashAmountInCents =
      overrides.cashAmountInCents ??
      (options.lineItems
        ? options.lineItems.reduce(
            (acc, li) => acc + BigInt((li.payRateInSubunits ?? 0) * Number(li.quantity ?? 1)),
            0n,
          )
        : BigInt(600_00));

    const [invoice] = await db
      .insert(invoices)
      .values({
        companyContractorId: contractor.id,
        userId: contractor.userId,
        createdById: contractor.userId,
        companyId: contractor.companyId,
        invoiceType: "services",
        status: "received",
        equityPercentage: 0,
        equityAmountInCents: BigInt(0),
        equityAmountInOptions: 0,
        cashAmountInCents,
        invoiceNumber: "INV-123456",
        totalAmountInUsdCents: cashAmountInCents,
        billFrom: user.legalName ?? "Test user",
        billTo: company.name ?? "N/A",
        dueOn: invoiceDate,
        countryCode: user.countryCode,
        invoiceDate,
        streetAddress: user.streetAddress,
        city: user.city,
        zipCode: user.zipCode,
        flexileFeeCents: BigInt(calculateFlexileFeeCents(Number(cashAmountInCents))),
        ...overrides,
      })
      .returning();
    assert(invoice != null);

    if (options.lineItems) {
      for (const lineItem of options.lineItems) {
        await invoiceLineItemsFactory.create({
          invoiceId: invoice.id,
          ...lineItem,
        });
      }
    } else {
      await invoiceLineItemsFactory.create({
        invoiceId: invoice.id,
        payRateInSubunits: Number(invoice.totalAmountInUsdCents),
        quantity: "1",
      });
    }

    return { invoice };
  },
};
