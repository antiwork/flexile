import { db } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { wiseRecipients } from "@/db/schema";
import { assert } from "@/utils/assert";

export const wiseRecipientsFactory = {
  create: async (overrides: Partial<typeof wiseRecipients.$inferInsert> = {}) => {
    const [wiseRecipient] = await db
      .insert(wiseRecipients)
      .values({
        userId: overrides.userId || (await usersFactory.create()).user.id,
        wiseCredentialId: 1n,
        countryCode: "US",
        currency: "USD",
        recipientId: "148563324", // Test Wise Sandbox Recipient ID
        lastFourDigits: "1234",
        accountHolderName: "Jane Q. Contractor",
        usedForInvoices: true,
        ...overrides,
      })
      .returning();
    assert(wiseRecipient != null);

    return { wiseRecipient };
  },
};
