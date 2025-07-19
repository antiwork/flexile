import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { setClerkUser } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test("login", async ({ page }) => {
  const { user } = await usersFactory.create();
  const { email } = await setClerkUser(user.id);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

  await expect(page.getByText("Sign in to Flexile")).not.toBeVisible();
  await expect(page.getByText("Enter your password")).not.toBeVisible();

  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  expect(updatedUser?.currentSignInAt).not.toBeNull();
  expect(updatedUser?.currentSignInAt).not.toBe(user.currentSignInAt);
});

test("login with redirect_url", async ({ page }) => {
  const { user } = await usersFactory.create();
  const { email } = await setClerkUser(user.id);

  await page.goto("/people");

  await page.waitForURL(/\/login\?.*redirect_url=%2Fpeople/u);

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

  await expect(page.getByText("Sign in to Flexile")).not.toBeVisible();
  await expect(page.getByText("Enter your password")).not.toBeVisible();

  expect(page.url()).toContain("/people");
});

test("shows error on invalid credentials and does not log in", async ({ page }) => {
  const { user } = await usersFactory.create();
  const { email } = await setClerkUser(user.id);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("wrongpassword");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Password is incorrect. Try again, or use another method.")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-describedby", "error-password");
});

test("shows generic error message on backend error during login", async ({ page }) => {
  const { user } = await usersFactory.create();
  const { email } = await setClerkUser(user.id);
  // Intercept the internal call and force a 500 error
  await page.route("**/internal/current_user_data**", (route) =>
    route.fulfill({ status: 500, body: "Internal Server Error" }),
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Something went wrong", { exact: true })).toBeVisible();
  await expect(page.getByText("Sorry about that. Please try again!", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home?" })).toBeVisible();
});

test("allows the user to log out from people page and contractor page", async ({ page }) => {
  const { adminUser, company } = await companiesFactory.createCompletedOnboarding();
  const { user: contractor } = await usersFactory.create();
  await companyContractorsFactory.create({ companyId: company.id, userId: contractor.id });

  const { email } = await setClerkUser(adminUser.id);
  // Log in as admin
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Go to people page and log out
  await page.goto("/people");
  // Collapse onboarding to unblock "Log out" button
  await page.locator("svg.lucide-chevron-down").click();
  await page.getByRole("button", { name: "Log out" }).click();
  // reload the page to ensure the user is logged out
  await expect(page).toHaveURL("/");
  await page.reload();

  // Log in again and go to contractor page, then log out
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.goto(`/people/${contractor.externalId}`);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
  await page.reload(); // reload the page to ensure the user is logged out
  await expect(page).toHaveURL("/");
});
