import { db } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { setTestUser } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test("login", async ({ page }) => {
  const { user } = await usersFactory.create();
  const { email } = await setTestUser(user.id);

  await page.goto("/login");

  await page.waitForTimeout(5000);

  // Enter email address
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification code" }).click();

  // Wait for OTP step and enter verification code
  await page.getByLabel("Verification code").waitFor();
  const testOtpCode = "000000"; // Test OTP code accepted by backend
  await page.getByLabel("Verification code").fill(testOtpCode);
  await page.getByRole("button", { name: "Login" }).click();

  // Verify successful login
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

  // Verify login page elements are no longer visible
  await expect(page.getByText("Login with email")).not.toBeVisible();
  await expect(page.getByText("Enter the 6-digit code")).not.toBeVisible();

  // Check that currentSignInAt was updated
  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  expect(updatedUser?.currentSignInAt).not.toBeNull();
  expect(updatedUser?.currentSignInAt).not.toBe(user.currentSignInAt);
});

test("login with redirect_url", async ({ page }) => {
  const { user } = await usersFactory.create();
  const { email } = await setTestUser(user.id);

  await page.goto("/people");

  await page.waitForURL(/\/login\?.*redirect_url=%2Fpeople/u);

  // Enter email address
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification code" }).click();

  // Wait for OTP step and enter verification code
  await page.getByLabel("Verification code").waitFor();
  const testOtpCode = "000000"; // Test OTP code accepted by backend
  await page.getByLabel("Verification code").fill(testOtpCode);
  await page.getByRole("button", { name: "Login" }).click();

  // Verify redirect to the intended page
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

  // Verify login page elements are no longer visible
  await expect(page.getByText("Login with email")).not.toBeVisible();
  await expect(page.getByText("Enter the 6-digit code")).not.toBeVisible();

  expect(page.url()).toContain("/people");
});
