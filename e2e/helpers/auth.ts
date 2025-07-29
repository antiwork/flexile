import { type Page } from "@playwright/test";
import { db } from "@test/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

// Test OTP code that should be accepted in test environment
// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
const TEST_OTP_CODE = "000000";

const testUsers = [
  { email: "test1+e2e@example.com" },
  { email: "test2+e2e@example.com" },
  { email: "test3+e2e@example.com" },
  { email: "test4+e2e@example.com" },
];

let currentTestUser: (typeof testUsers)[number] | undefined;

export const clearTestUser = async () => {
  currentTestUser = undefined;
};

export const setTestUser = async (id: bigint) => {
  await clearTestUser();
  for (const testUser of testUsers) {
    try {
      // Update user email to match our test user
      await db.update(users).set({ email: testUser.email }).where(eq(users.id, id));
      currentTestUser = testUser;
      break;
    } catch {}
  }
  if (!currentTestUser) {
    throw new Error("Failed to set test user");
  }
  return currentTestUser;
};

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  const testUser = await setTestUser(user.id);

  // Fill email and submit to get OTP
  await page.getByLabel("Email address").fill(testUser.email);
  await page.getByRole("button", { name: "Send verification code" }).click();

  // Wait for OTP step to appear
  await page.getByLabel("Verification code").waitFor();

  // Use test OTP code - backend should accept this in test environment
  await page.getByLabel("Verification code").fill(TEST_OTP_CODE);
  await page.getByRole("button", { name: "Login" }).click();

  // Wait for successful redirect
  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  // Navigate to a page with logout functionality
  await page.goto("/dashboard");

  // Look for logout button (this may vary based on your UI)
  const logoutButton = page.getByRole("button", { name: "Logout" }).first();
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }

  // Wait for redirect to login
  await page.waitForURL(/.*\/login.*/u);
};

/**
 * Performs signup flow with OTP authentication
 */
export const signup = async (page: Page, email: string) => {
  await page.goto("/signup");

  // Enter email and request OTP
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification code" }).click();

  // Wait for OTP step and enter verification code
  await page.getByLabel("Verification code").waitFor();
  await page.getByLabel("Verification code").fill(TEST_OTP_CODE);
  await page.getByRole("button", { name: "Create account" }).click();

  // Wait for successful redirect to onboarding or dashboard
  await page.waitForURL(/^(?!.*\/(signup|login)$).*/u);
};
