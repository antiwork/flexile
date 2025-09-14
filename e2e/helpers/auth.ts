import { expect, type Page } from "@playwright/test";
import { users } from "@/db/schema";

// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
const TEST_OTP_CODE = "000000";

export const fillOtp = async (page: Page) => {
  // Wait for the OTP input to be visible before filling
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
  // If already on login, nothing to do
  if (page.url().includes("/login")) {
    return;
  }

  // Ensure on a dashboard route (so logout button exists)
  if (!page.url().includes("/invoices")) {
    // best-effort navigation; if already there, it's fast
    await page.goto("/invoices").catch(() => {
      // ignore navigation errors here
    });
  }

  // Click the visible logout button (there may be multiple)
  await page.getByRole("button", { name: "Log out" }).first().click();

  // Wait for redirect to login
  await page.waitForURL(/.*\/login.*/u);
  await page.waitForLoadState("networkidle");
};

export const externalProviderMock = async (page: Page, provider: string, credentials: { email: string }) => {
  // Intercept the callback POST and inject the test email into the form body.
  await page.route(`**/api/auth/callback/${provider}`, async (route) => {
    try {
      const postData = await route.request().postData();

      if (!postData) {
        await route.continue();
        return;
      }

      // Try parsing JSON body
      let parsed: Record<string, unknown> | null = null;
      if (typeof postData === "string") {
        try {
          parsed = JSON.parse(postData);
        } catch {
          parsed = null;
        }
      }

      // If JSON parse failed, attempt to parse as URLSearchParams
      if (parsed === null && typeof postData === "string") {
        try {
          const params = new URLSearchParams(postData);
          parsed = {};
          for (const [k, v] of params.entries()) {
            parsed[k] = v;
          }
        } catch {
          parsed = null;
        }
      }

      if (parsed && typeof parsed === "object") {
        const modified = new URLSearchParams();
        for (const [k, v] of Object.entries(parsed)) {
          modified.set(k, String(v ?? ""));
        }
        modified.set("email", credentials.email);
        await route.continue({ postData: modified.toString() });
        return;
      }

      // Fallback: continue without modification
      await route.continue();
    } catch (err) {
      // Ensure we continue the request on any unexpected error so tests don't hang.
      // Log minimally for local debugging.
      // eslint-disable-next-line no-console
      console.error("externalProviderMock error:", String(err));
      await route.continue();
    }
  });
};
