// e2e/mocks/handlers.ts
import { delay, http, HttpResponse } from "msw";

// Types for better type safety in our mocks
interface _StripePaymentIntent {
  id: string;
  object: "payment_intent";
  client_secret: string;
  status:
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_action"
    | "processing"
    | "succeeded"
    | "canceled";
  amount: number;
  currency: string;
  payment_method?: string;
  created: number;
  livemode: boolean;
}

interface _StripeSetupIntent {
  id: string;
  object: "setup_intent";
  client_secret: string;
  status:
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_action"
    | "processing"
    | "succeeded"
    | "canceled";
  payment_method?: string;
  created: number;
  livemode: boolean;
  next_action?: {
    type: "verify_with_microdeposits";
    verify_with_microdeposits: {
      arrival_date: number;
      hosted_verification_url: string;
      microdeposit_type: "descriptor_code" | "amount";
    };
  };
}

interface _StripePaymentMethod {
  id: string;
  object: "payment_method";
  type: "us_bank_account" | "card";
  us_bank_account?: {
    account_holder_type: "individual" | "company";
    account_type: "checking" | "savings";
    bank_name: string;
    fingerprint: string;
    last4: string;
    routing_number: string;
  };
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface _WiseRecipient {
  id: string;
  currency: string;
  last_four_digits: string;
  account_holder_name: string;
}

interface _WiseTransfer {
  id: string;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  created_at: string;
  estimated_delivery_date: string;
}

interface _WiseBalance {
  id: string;
  currency: string;
  amount: number;
}

// Mock data consistent with backend Ruby tests
const mockData = {
  stripe: {
    paymentMethods: {
      us_bank_account: {
        id: "pm_test_us_bank_account",
        object: "payment_method",
        type: "us_bank_account",
        us_bank_account: {
          account_holder_type: "individual",
          account_type: "checking",
          bank_name: "STRIPE TEST BANK",
          fingerprint: "FFDMA0jJDFjDf0aS",
          last4: "6789",
          routing_number: "110000000",
        },
        created: Date.now() / 1000,
        livemode: false,
      },
    },
    setupIntents: {
      requiresPaymentMethod: {
        id: "seti_mock_requires_payment_method",
        object: "setup_intent",
        client_secret: "seti_mock_requires_payment_method_secret_test",
        status: "requires_payment_method",
        created: Date.now() / 1000,
        livemode: false,
      },
      requiresConfirmation: {
        id: "seti_mock_requires_confirmation",
        object: "setup_intent",
        client_secret: "seti_mock_requires_confirmation_secret_test",
        status: "requires_confirmation",
        created: Date.now() / 1000,
        livemode: false,
      },
      requiresAction: {
        id: "seti_mock_requires_action",
        object: "setup_intent",
        client_secret: "seti_mock_requires_action_secret_test",
        status: "requires_action",
        created: Date.now() / 1000,
        livemode: false,
        next_action: {
          type: "verify_with_microdeposits",
          verify_with_microdeposits: {
            arrival_date: Math.floor(Date.now() / 1000) + 172800, // +2 days in seconds
            hosted_verification_url: "https://payments.stripe.com/verification/microdeposits/test_mock",
            microdeposit_type: "descriptor_code",
          },
        },
      },
      succeeded: {
        id: "seti_mock_succeeded",
        object: "setup_intent",
        client_secret: "seti_mock_succeeded_secret_test",
        status: "succeeded",
        payment_method: "pm_test_us_bank_account",
        created: Date.now() / 1000,
        livemode: false,
      },
    },
    paymentIntents: {
      requiresPaymentMethod: {
        id: "pi_mock_requires_payment_method",
        object: "payment_intent",
        client_secret: "pi_mock_requires_payment_method_secret_test",
        status: "requires_payment_method",
        amount: 1000,
        currency: "usd",
        created: Date.now() / 1000,
        livemode: false,
      },
      succeeded: {
        id: "pi_mock_succeeded",
        object: "payment_intent",
        client_secret: "pi_mock_succeeded_secret_test",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        payment_method: "pm_test_us_bank_account",
        created: Date.now() / 1000,
        livemode: false,
      },
    },
  },
  wise: {
    recipient: {
      id: "148563324",
      currency: "USD",
      last_four_digits: "1234",
      account_holder_name: "Test Recipient",
    },
    transfer: {
      id: "50500593",
      status: "incoming_payment_waiting",
      reference: "Invoice Payment",
      amount: 100.0,
      currency: "USD",
      created_at: new Date().toISOString(),
      estimated_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // +2 days
    },
    balance: {
      id: "12345",
      currency: "USD",
      amount: 1000.0,
    },
  },
};

// Stripe API Handlers
const stripeHandlers = [
  // Create Payment Intent
  http.post("https://api.stripe.com/v1/payment_intents", async ({ request }) => {
    const formData = await request.formData();
    const amount = formData.get("amount") || 1000;
    const currency = formData.get("currency") || "usd";

    const paymentIntent = {
      ...mockData.stripe.paymentIntents.requiresPaymentMethod,
      amount: Number(amount),
      currency: currency.toString(),
    };

    return HttpResponse.json(paymentIntent);
  }),

  // Create Setup Intent
  http.post("https://api.stripe.com/v1/setup_intents", async () =>
    // Default to requires_payment_method status
    HttpResponse.json(mockData.stripe.setupIntents.requiresPaymentMethod),
  ),

  // Retrieve Setup Intent
  http.get("https://api.stripe.com/v1/setup_intents/:id", ({ params }) => {
    const { id } = params;

    // Return different responses based on the ID
    if (id === "seti_mock_requires_action") {
      return HttpResponse.json(mockData.stripe.setupIntents.requiresAction);
    } else if (id === "seti_mock_succeeded") {
      return HttpResponse.json(mockData.stripe.setupIntents.succeeded);
    } else if (id === "seti_mock_requires_confirmation") {
      return HttpResponse.json(mockData.stripe.setupIntents.requiresConfirmation);
    }
    return HttpResponse.json(mockData.stripe.setupIntents.requiresPaymentMethod);
  }),

  // Create Payment Method
  http.post("https://api.stripe.com/v1/payment_methods", async () =>
    HttpResponse.json(mockData.stripe.paymentMethods.us_bank_account),
  ),

  // Retrieve Payment Method
  http.get("https://api.stripe.com/v1/payment_methods/:id", ({ params: _params }) =>
    HttpResponse.json(mockData.stripe.paymentMethods.us_bank_account),
  ),

  // Attach Payment Method to Setup Intent
  http.post("https://api.stripe.com/v1/setup_intents/:id/confirm", async ({ params }) => {
    const { id } = params;

    // Simulate processing delay
    await delay(500);

    if (id.includes("action")) {
      return HttpResponse.json(mockData.stripe.setupIntents.requiresAction);
    }
    return HttpResponse.json(mockData.stripe.setupIntents.succeeded);
  }),

  // Handle microdeposit verification
  http.post("https://api.stripe.com/v1/setup_intents/:id/verify_microdeposits", async () => {
    // Simulate processing delay
    await delay(500);

    return HttpResponse.json(mockData.stripe.setupIntents.succeeded);
  }),
];

// Wise API Handlers (internal API endpoints)
const wiseHandlers = [
  // Create Wise Recipient
  http.post("/api/wise/recipients", async ({ request }) => {
    const data = await request.json();

    const recipient = {
      ...mockData.wise.recipient,
      currency: data.currency || mockData.wise.recipient.currency,
      account_holder_name: data.account_holder_name || mockData.wise.recipient.account_holder_name,
    };

    return HttpResponse.json(recipient);
  }),

  // Create Wise Transfer
  http.post("/api/wise/transfers", async ({ request }) => {
    const data = await request.json();

    const transfer = {
      ...mockData.wise.transfer,
      amount: data.amount || mockData.wise.transfer.amount,
      currency: data.currency || mockData.wise.transfer.currency,
      reference: data.reference || mockData.wise.transfer.reference,
    };

    return HttpResponse.json(transfer);
  }),

  // Get Wise Balances
  http.get("/api/wise/balances", () => HttpResponse.json([mockData.wise.balance])),

  // Get Wise Transfer Status
  http.get("/api/wise/transfers/:id", ({ params }) => {
    const { id } = params;

    const transfer = {
      ...mockData.wise.transfer,
      id: id.toString(),
    };

    return HttpResponse.json(transfer);
  }),
];

// Other API handlers (Resend, etc.)
const otherHandlers = [
  // Mock Resend email API
  http.post("https://api.resend.com/emails", async () =>
    HttpResponse.json({
      id: "email_mock_id",
      from: "onboarding@flexile.dev",
      to: "recipient@example.com",
      status: "sent",
    }),
  ),
];

// Error scenario handlers
const errorHandlers = [
  // Stripe payment intent creation failure
  http.post(
    "https://api.stripe.com/v1/payment_intents/error",
    () =>
      new HttpResponse(
        JSON.stringify({
          error: {
            code: "card_declined",
            doc_url: "https://stripe.com/docs/error-codes/card-declined",
            message: "Your card was declined.",
            type: "card_error",
          },
        }),
        { status: 402 },
      ),
  ),

  // Wise transfer failure
  http.post(
    "/api/wise/transfers/error",
    () =>
      new HttpResponse(
        JSON.stringify({
          error: "INSUFFICIENT_FUNDS",
          message: "Not enough funds in the account",
        }),
        { status: 422 },
      ),
  ),
];

// Combine all handlers
export const handlers = [...stripeHandlers, ...wiseHandlers, ...otherHandlers, ...errorHandlers];
