import { db, takeOrThrow } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { mockLogin } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test("signup from signup page", async ({ page }) => {
  const email = "oauth-signup-e2e@example.org";
  await db.delete(users).where(eq(users.email, email));

  await mockLogin(page, email, "google");

  await page.goto("/signup");
  await page.getByRole("button", { name: "Sign up with Google" }).click();
  await page.waitForURL(/.*\/invoices.*/u);
  await page.getByText("Add company details").waitFor();

  const user = await takeOrThrow(db.query.users.findFirst({ where: eq(users.email, email) }));
  expect(user).toBeDefined();
});

test("signup from login page", async ({ page }) => {
  const email = "oauth-signup-e2e@example.org";
  await db.delete(users).where(eq(users.email, email));

  await mockLogin(page, email, "google");

  await page.goto("/login");
  await page.getByRole("button", { name: "Log in with Google" }).click();
  await page.waitForURL(/.*\/invoices.*/u);
  await page.getByText("Add company details").waitFor();

  const user = await takeOrThrow(db.query.users.findFirst({ where: eq(users.email, email) }));
  expect(user).toBeDefined();
});

test("login", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await mockLogin(page, email, "google");

  await page.goto("/login");
  await page.getByRole("button", { name: "Log in with Google" }).click();

  await page.waitForURL(/.*\/invoices.*/u);
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  expect(updatedUser?.currentSignInAt).not.toBeNull();
  expect(updatedUser?.currentSignInAt).not.toBe(user.currentSignInAt);
});

test("login with redirect_url", async ({ page }) => {
  const { user } = await usersFactory.create();
  const email = user.email;

  await page.goto("/people");

  await page.waitForURL(/\/login\?.*redirect_url=%2Fpeople/u);

  await mockLogin(page, email, "google");
  await page.getByRole("button", { name: "Log in with Google" }).click();

  await page.waitForURL(/.*\/people.*/u);

  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByText("Welcome back")).not.toBeVisible();
  expect(page.url()).toContain("/people");
});
