import { db } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test("login", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

  await expect(page.getByText("Sign in to Flexile")).not.toBeVisible();
  await expect(page.getByText("Enter your password")).not.toBeVisible();

  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  expect(updatedUser?.currentSignInAt).not.toBeNull();
  expect(updatedUser?.currentSignInAt).not.toBe(user.currentSignInAt);
});

test("login with redirect_url", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await page.goto("/people");

  await page.waitForURL(/\/login\?.*redirect_url=%2Fpeople/u);

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

  await expect(page.getByText("Sign in to Flexile")).not.toBeVisible();
  await expect(page.getByText("Enter your email")).not.toBeVisible();

  expect(page.url()).toContain("/people");
});
