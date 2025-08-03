import { type Page } from "@playwright/test";
import type { NextFixture } from "next/experimental/testmode/playwright";

export const mockQuickbooks = (next: NextFixture) => {
  next.onFetch((request) => {
    const url = new URL(request.url);

    if (url.pathname.includes("quickbooks.getAuthUrl")) {
      return Response.json(
        "https://appcenter.intuit.com/connect/oauth2?client_id=test&scope=com.intuit.quickbooks.accounting&redirect_uri=http://localhost:3000/oauth_redirect&response_type=code&access_type=offline&state=test_state",
      );
    }

    if (url.pathname.includes("quickbooks.connect")) {
      return Response.json({ success: true });
    }

    if (url.pathname.includes("quickbooks.get")) {
      return Response.json({
        status: "active",
        consultingServicesExpenseAccountId: "789",
        flexileFeesExpenseAccountId: "790",
        equityCompensationExpenseAccountId: "792",
        defaultBankAccountId: "791",
        expenseAccounts: [
          { id: "789", name: "Professional Services" },
          { id: "790", name: "Software Subscriptions" },
          { id: "792", name: "Equity Compensation" },
        ],
        bankAccounts: [
          { id: "791", name: "Business Checking" },
          { id: "793", name: "Savings Account" },
        ],
      });
    }
  });

  const mockOAuthFlow = async (page: Page) => {
    await page.addInitScript(() => {
      window.open = () => {
        const popup = {
          location: {
            href: "http://localhost:3000/oauth_redirect?code=test_code&state=test_state&realmId=test_realm",
          },
          close: () => {
            console.log("Mock popup closed");
          },
          closed: false,
        };

        setTimeout(() => {
          window.postMessage("oauth-complete", window.location.origin);
        }, 100);

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return popup as unknown as Window;
      };
    });
  };

  return { mockOAuthFlow };
};
