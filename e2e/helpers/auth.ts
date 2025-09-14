import { expect, type Page } from "@playwright/test";
import { users } from "@/db/schema";

// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
const TEST_OTP_CODE = "000000";

export const fillOtp = async (page: Page) => {
  const otp = page.getByRole("textbox", { name: "Verification code" });
  await expect(otp).toBeVisible();
  await otp.fill(TEST_OTP_CODE);
};

export const login = async (page: Page, user: typeof users.$inferSelect, redirectTo?: string) => {
  const pageURL = redirectTo ? redirectTo : "/login";
  await page.goto(pageURL);

  await page.getByLabel("Work email").fill(user.email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await fillOtp(page);

  // Wait for navigation away from login page (ensures login finished)
  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  if (page.url().includes("/login")) {
    return;
  }

  // Ensure we're on a dashboard page with sidebar
  if (!page.url().includes("/invoices")) {
    await page.goto("/invoices");
  }

  await page.getByRole("button", { name: "Log out" }).first().click();

  // Wait for redirect to login and for network to be idle (logout finished)
  await page.waitForURL(/.*\/login.*/u);
  await page.waitForLoadState("networkidle");
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Mock external OAuth provider callback so tests can override returned email.
 * Rewrites the POST body to include the provided credentials.email when possible.
 */
export const externalProviderMock = async (page: Page, provider: string, credentials: { email: string }) => {
  await page.route(`**/api/auth/callback/${provider}`, async (route) => {
    try {
      const req = route.request();
      const raw = req.postData() ?? "";

      let parsed: unknown = null;
      if (typeof raw === "string" && raw.length > 0) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }

      if (isRecord(parsed)) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          flat[k] = v == null ? "" : String(v);
        }
        flat.email = credentials.email;
        const modifiedData = new URLSearchParams(flat).toString();
        await route.continue({ postData: modifiedData });
        return;
      }

      // Fallback: continue with the original request unchanged
      await route.continue();
    } catch (errUnknown) {
      // Log the error but continue the route so tests do not fail due to the mock.
      // eslint-disable-next-line no-console
      console.warn("externalProviderMock route handler error:", String(errUnknown ?? ""));
      await route.continue();
    }
  });
};
