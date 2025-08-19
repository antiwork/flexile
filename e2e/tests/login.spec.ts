import { db } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { fillOtp } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test("login", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await page.goto("/login");

  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  const otpField = page.getByLabel("Verification code");
  await otpField.fill("000001");
  await expect(otpField).not.toBeValid();
  await expect(page.getByText("Invalid verification code")).toBeVisible();
  await fillOtp(page);

  await page.waitForURL(/.*\/invoices.*/u);

  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

  await expect(page.getByText("Welcome back")).not.toBeVisible();
  await expect(page.getByText("Check your email for a code")).not.toBeVisible();

  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  expect(updatedUser?.currentSignInAt).not.toBeNull();
  expect(updatedUser?.currentSignInAt).not.toBe(user.currentSignInAt);
});

test("login with redirect_url", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await page.goto("/people");

  await page.waitForURL(/\/login\?.*redirect_url=%2Fpeople/u);

  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await fillOtp(page);

  // No need to click the button as it should auto-submit
  await page.waitForURL(/.*\/people.*/u);

  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

  await expect(page.getByText("Welcome back")).not.toBeVisible();
  await expect(page.getByText("Use your work email to log in.")).not.toBeVisible();

  expect(page.url()).toContain("/people");
});

test("OTP input validation and auto-submit behavior", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await page.goto("/login");

  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  const otpField = page.getByLabel("Verification code");

  // Test that non-numeric characters are filtered out
  await otpField.fill("abc123");
  await expect(otpField).toHaveValue("123");

  // Test that only 6 digits trigger auto-submit
  await otpField.fill("12345"); // 5 digits - should not auto-submit
  await expect(page.getByText("Verifying...")).not.toBeVisible();

  // Fill with 6 digits - should trigger auto-submit
  await otpField.fill("000000");

  // Should show "Verifying your code..." status
  await expect(page.getByText("Verifying your code...")).toBeVisible();

  // Wait for redirect
  await page.waitForURL(/.*\/invoices.*/u);
});
