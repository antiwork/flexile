import { createClerkClient } from "@clerk/backend";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { db } from "@test/db";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test("company signup flow", async ({ page }) => {
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
});
