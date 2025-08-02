import { type Page } from "@playwright/test";
import { users } from "@/db/schema";

// Test OTP code that should be accepted in test environment
// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
const TEST_OTP_CODE = "000000";

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  // Fill email and submit to get OTP
  await page.getByLabel("Work email").fill(user.email);
  await page.getByRole("button", { name: "Log in" }).click();

  // Wait for OTP step to appear
  await page.getByLabel("Verification code").waitFor();

  // Use test OTP code - backend should accept this in test environment
  await page.getByLabel("Verification code").fill(TEST_OTP_CODE);
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for successful redirect
  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  const gettingStartedInnerTrigger = page.getByTestId("getting-started-inner-trigger");

  // Make sure Getting Started inner panel is closed
  if (await gettingStartedInnerTrigger.isVisible().catch(() => false)) {
    const isExpanded = await gettingStartedInnerTrigger.getAttribute("aria-expanded").catch(() => null);

    if (isExpanded === "true") {
      // Click the trigger to collapse it
      await gettingStartedInnerTrigger.click();
      // Wait a moment for the animation to complete
      await page.waitForTimeout(300);
    }
  }

  await page.getByRole("button", { name: "Log out" }).first().click();

  // Wait for redirect to login
  await page.waitForURL(/.*\/login.*/u);
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
  await page.getByLabel("Verification code").fill(TEST_OTP_CODE);
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for successful redirect to onboarding or dashboard
  await page.waitForURL(/^(?!.*\/(signup|login)$).*/u);
};
