import { expect, type Page } from "@playwright/test";
import type { NextFixture } from "next/experimental/testmode/playwright";
import { z } from "zod";
import type { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

type MaybePromise<T> = T | Promise<T>;

type Account = Pick<typeof users.$inferSelect, "email" | "id">;
let lastAccountId = 1;
export const mockStripe = (
  next: NextFixture,
  {
    accounts,
    validateValues,
  }: {
    accounts?: () => MaybePromise<Record<string, Account>>;
    validateValues?: (role: string, values: Record<string, string>) => MaybePromise<void>;
  },
) => {
  next.onFetch(async (request) => {
    if (!accounts) return;
    if (request.url === "https://api.stripe.com/v1/accounts") {
      expect(await request.json()).toEqual({
        type: "express",
        country: "US",
        email: expect.any(String),
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "company",
      });
      return Response.json({
        id: `acct_${lastAccountId.toString().padStart(16, "0")}${lastAccountId++}`,
        type: "express",
        country: "US",
        created: Math.floor(Date.now() / 1000),
      });
    } else if (request.url.startsWith("https://api.stripe.com/v1/accounts/")) {
      return Response.json({
        id: request.url.split("/").pop(),
        type: "express",
        country: "US",
        external_accounts: {
          data: [
            {
              id: `ba_${Math.random().toString(36).substr(2, 16)}`,
              object: "bank_account",
              account_holder_type: "company",
              bank_name: "Test Bank",
              country: "US",
              currency: "usd",
              last4: "6789",
              routing_number: "110000000",
              status: "new",
            },
          ],
        },
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
        },
        charges_enabled: false,
        payouts_enabled: false,
      });
    } else if (request.url.startsWith("https://api.stripe.com/v1/account_links")) {
      const role = assertDefined(
        Object.entries(await accounts()).find(
          ([_, account]) => account.id === BigInt(request.url.split("/").at(-1) ?? ""),
        )?.[0],
      );
      const json = z.object({ values: z.record(z.string(), z.string()) }).parse(await request.json());
      await validateValues?.(role, json.values);
      return new Response();
    }
  });

  const mockForm = async (page: Page) => {
    await page.route("https://js.stripe.com/v3/elements-inner-payment*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `
          <html>
            <body>
              <div>
                <label>
                  <input type="radio" name="institution" value="test">
                  Test Institution
                </label>
                <button>Enter bank details manually instead</button>
              </div>
            </body>
          </html>
        `,
      }),
    );

    await page.route("https://js.stripe.com/v3/linked-accounts-inner*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `
          <html>
            <body>
              <div>
                <button>Agree</button>
                <div data-testid="success">success</div>
                <button>High Balance</button>
                <button>Connect account</button>
                <button>Back to Flexile</button>
                <input type="text" placeholder="Routing number" />
                <input data-testid="manualEntry-accountNumber-input" type="text" placeholder="Account number" />
                <input data-testid="manualEntry-confirmAccountNumber-input" type="text" placeholder="Confirm account number" />
                <button>Submit</button>
                <div>Next, finish up on Flexile to initiate micro-deposits. You can expect an email with instructions within 1-2 business days.</div>
              </div>
            </body>
          </html>
        `,
      }),
    );
  };

  return { mockForm };
};
