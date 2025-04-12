import { createClerkClient } from "@clerk/backend";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("Company administrator signup", () => {
  test("successfully signs up the company", async ({ page }) => {
    test.skip(); // Skipped until Clerk is removed
    const email = "admin-signup+clerk_test@example.com";
    const clerk = createClerkClient({ secretKey: assertDefined(process.env.CLERK_SECRET_KEY) });
    const [clerkUser] = (await clerk.users.getUserList({ emailAddress: [email] })).data;
    if (clerkUser) await clerk.users.deleteUser(clerkUser.id);
    await setupClerkTestingToken({ page });
    const name = faker.person.fullName();
    const companyName = faker.company.name();
    const streetAddress = faker.location.streetAddress();
    const city = faker.location.city();
    const state = "Missouri";
    const zipCode = faker.location.zipCode();
    const password = faker.internet.password();

    await page.goto("/signup");

    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("I agree to the Terms of Service and Privacy Policy").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(1000); // work around a Clerk issue
    await page.getByLabel("Verification code").fill("424242");

    await page.getByRole("radio", { name: "Company" }).check();
    await expect(page.getByText("Let's get to know you")).toBeVisible();

    const user = assertDefined(await db.query.users.findFirst({ where: eq(users.email, email) }));

    await page.getByLabel("Your full legal name").fill(name);
    await page.getByLabel("Your company's legal name").fill(companyName);
    await page.getByLabel("Street address, apt number").fill(streetAddress);
    await page.getByLabel("City").fill(city);
    await page.getByLabel("State").selectOption(state);
    await page.getByLabel("ZIP code").fill(zipCode);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Link your bank account")).toBeVisible();

    const company = await db.query.companies.findFirst({ where: eq(companies.name, companyName) }).then(takeOrThrow);
    expect(company.name).toBe(companyName);
    expect(company.streetAddress).toBe(streetAddress);
    expect(company.city).toBe(city);
    expect(company.state).toBe("MO");
    expect(company.zipCode).toBe(zipCode);

    const updatedUser = await db.query.users
      .findFirst({
        where: eq(users.id, user.id),
      })
      .then(takeOrThrow);
    expect(updatedUser.legalName).toBe(name);
  });
});
