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

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  await page.getByLabel("Work email").fill(user.email);
  await page.getByRole("button", { name: "Log in" }).click();
  await fillOtp(page);

  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  if (page.url().includes("/login")) {
    return;
  }
  if (!page.url().includes("/invoices")) {
    // Navigate to invoices page to ensure we're on a dashboard page with sidebar
    await page.goto("/invoices");
  }
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
  await page.getByRole("button", { name: "Sign up" }).click();

  // Wait for OTP step and enter verification code
  await page.getByLabel("Verification code").waitFor();

  await fillOtp(page);
  await page.waitForURL(/^(?!.*\/(signup|login)$).*/u);
};
