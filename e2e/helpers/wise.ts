import type { NextFixture } from "next/experimental/testmode/playwright";

/**
 * Mock Wise (TransferWise) API responses
 * Based on the DocuSeal mock pattern
 */
export const mockWise = (next: NextFixture, _config: Record<string, unknown> = {}) => {
  next.onFetch(async (request) => {
    // Mock Wise recipient creation
    if (
      request.url.includes("wise.com/v1/accounts") ||
      request.url.includes("wise.com/v2/accounts") ||
      request.url.includes("api.transferwise.com")
    ) {
      const body = await request.json().catch(() => ({}));

      // Return mock recipient data based on currency
      const currency = body.currency || "USD";
      const mockRecipientId = `mock_recipient_${currency.toLowerCase()}_${Date.now()}`;

      return Response.json({
        id: mockRecipientId,
        accountHolderName: body.accountHolderName || "Test Account Holder",
        currency,
        country: body.country || "US",
        type: body.type || "CHECKING",
        details: {
          accountNumber: body.details?.accountNumber || "12345678",
          routingNumber: body.details?.routingNumber || "071004200",
          accountType: "CHECKING",
          address: {
            country: body.country || "US",
            city: body.details?.address?.city || "Test City",
            postCode: body.details?.address?.postCode || "12345",
            firstLine: body.details?.address?.firstLine || "123 Test St",
          },
        },
        active: true,
        ownedByCustomer: true,
      });
    }

    // Mock Wise validation endpoints
    if (request.url.includes("wise.com/v1/validators") || request.url.includes("wise.com/v1/quotes")) {
      return Response.json({
        validation: {
          success: true,
          errors: [],
        },
      });
    }

    // Mock getting Wise balances
    if (request.url.includes("wise.com/v1/balances") || request.url.includes("wise.com/v3/profiles")) {
      return Response.json({
        balances: [
          {
            currency: "USD",
            amount: { value: 10000, currency: "USD" },
          },
          {
            currency: "EUR",
            amount: { value: 5000, currency: "EUR" },
          },
        ],
      });
    }
  });
};
