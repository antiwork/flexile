import { expect, type Page } from "@playwright/test";
import { users } from "@/db/schema";

// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
const TEST_OTP_CODE = "000000";

export const fillOtp = async (page: Page) => {
  // Wait for the OTP input to be visible before filling
  const otp = page.locator('[data-input-otp="true"]');
  await expect(otp).toBeVisible();
  await otp.fill(TEST_OTP_CODE);
};

export const login = async (page: Page, user: typeof users.$inferSelect, redirectTo?: string) => {
  const pageURL = redirectTo ? redirectTo : "/login";
  await page.goto(pageURL);

  await page.getByLabel("Work email").fill(user.email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await fillOtp(page);

  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  // Navigate to invoices page to ensure we're on a dashboard page with sidebar
  await page.goto("/invoices");

  await page.getByRole("button", { name: "Log out" }).first().click();

  // Wait for redirect to login
  await page.waitForURL(/.*\/login.*/u);
  await page.waitForLoadState("networkidle");
};

/**
 * Performs signup flow with OTP authentication
 */
export const signup = async (page: Page, email: string) => {
  await page.goto("/signup");

  // Enter email and request OTP
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  // Wait for OTP step and enter verification code
  await page.getByLabel("Verification code").waitFor();

  await fillOtp(page);
  await page.waitForURL(/^(?!.*\/(signup|login)$).*/u);
};

export const externalProviderMock = async (page: Page, provider: string, credentials: { email: string }) => {
  await page.route(`**/api/auth/callback/${provider}`, async (route) => {
    const body = await route.request().postDataJSON();
    const modifiedData = new URLSearchParams({ ...body, email: credentials.email }).toString();
    await route.continue({ postData: modifiedData });
  });
};
