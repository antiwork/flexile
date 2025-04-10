import { createClerkClient } from "@clerk/backend";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { db } from "@test/db";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test("contractor signup flow", async ({ page }) => {
  test.skip(); // Skipped until Clerk is removed
  const clerk = createClerkClient({ secretKey: assertDefined(process.env.CLERK_SECRET_KEY) });
  const email = "signup+clerk_test@example.com";
  const [clerkUser] = (await clerk.users.getUserList({ emailAddress: [email] })).data;
  if (clerkUser) await clerk.users.deleteUser(clerkUser.id);
  await setupClerkTestingToken({ page });
  await page.goto("/signup");

  // Initial signup page
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByText("Create your account")).toBeVisible();

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("testpassword123");
  await page.getByLabel("I agree to the Terms of Service and Privacy Policy").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForTimeout(1000); // work around a Clerk issue
  await page.getByLabel("Verification code").fill("424242");

  await expect(page.getByText("Let's get to know you")).toBeVisible();
  const user = assertDefined(await db.query.users.findFirst({ where: eq(users.email, email) }));
  expect(user.confirmedAt).toBeInstanceOf(Date);

  // Personal info page
  await page.getByLabel("Freelancer").check();
  await page.getByLabel("Full legal name").fill("John Doe");
  await page.getByLabel("Preferred name (visible to others)").fill("John");
  await page.getByLabel("Country of citizenship").selectOption("United States");
  await page.getByLabel("Country of residence").selectOption("United States");
  await page.getByRole("button", { name: "Continue" }).click();

  // Billing info page
  await expect(page.getByText("How will you be billing?")).toBeVisible();
  await page.getByLabel("I'm an individual").check();
  await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Main St");
  await page.getByLabel("City").fill("New York");
  await page.getByLabel("State").selectOption("New York");
  await page.getByLabel("Zip code").fill("10001");
  await page.getByRole("button", { name: "Continue" }).click();

  // Bank account setup
  await expect(page.getByText("Get Paid Fast")).toBeVisible();
  await page.getByRole("button", { name: "Set up" }).click();
  await page.getByLabel("Currency").selectOption("USD (United States Dollar)");
  await page.getByLabel("Full name of the account holder").fill("John Doe");
  await page.getByLabel("Routing number").fill("071004200");
  await page.getByLabel("Account number").fill("12345678");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Country").fill("United States");
  await page.getByLabel("City").fill("New York");
  await page.getByLabel("Street address, apt number").fill("123 Main St");
  await page.getByLabel("State").fill("New York");
  await page.getByLabel("ZIP code").fill("10001");
  await page.getByRole("button", { name: "Save bank account" }).click();

  await expect(page.getByText("Account ending in 5678")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // Final page
  await expect(page.getByRole("heading", { name: "Who are you billing?" })).toBeVisible();
});
