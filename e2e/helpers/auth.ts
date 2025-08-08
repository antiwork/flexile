import { type Page } from "@playwright/test";
import { users } from "@/db/schema";

// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
const TEST_OTP_CODE = "000000";

const fillOtp = async (page: Page) => {
  const inputOtp = page.locator('[data-slot="input-otp"]');
  if (await inputOtp.isVisible()) {
    await inputOtp.fill(TEST_OTP_CODE);
  } else {
    await page.getByLabel("Verification code").fill(TEST_OTP_CODE);
  }
};

const continueAfterOtp = async (page: Page, navPattern: RegExp) => {
  const nav = page.waitForURL(navPattern);
  try {
    await page.getByRole("button", { name: "Continue" }).click({ timeout: 1000 });
  } catch {}
  await nav;
  await page.waitForLoadState("networkidle");
};

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  await page.getByLabel("Work email").fill(user.email);
  await page.getByRole("button", { name: "Log in" }).click();
  await fillOtp(page);
  await continueAfterOtp(page, /^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  // Navigate to invoices page to ensure we're on a dashboard page with navbar
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
  await page.getByRole("button", { name: "Sign up" }).click();

  // Wait for OTP step and enter verification code
  await page.getByLabel("Verification code").waitFor();
  await fillOtp(page);
  await continueAfterOtp(page, /^(?!.*\/(signup|login)$).*/u);
};
