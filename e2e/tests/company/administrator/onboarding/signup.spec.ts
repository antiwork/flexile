import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Company administrator signup", () => {
  test("successfully signs up the company", async ({ page }) => {
    const email = "admin-signup+e2e@example.com";

    // Clean up any existing user with this email
    await db.delete(users).where(eq(users.email, email));

    const name = faker.person.fullName();
    const companyName = faker.company.name();
    const streetAddress = faker.location.streetAddress();
    const city = faker.location.city();
    const state = faker.location.state();
    const zipCode = faker.location.zipCode();

    await page.goto("/signup");

    // Enter email and request OTP
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send verification code" }).click();

    // Wait for OTP step and enter verification code
    await page.getByLabel("Verification code").waitFor();
    await page.getByLabel("Verification code").fill("000000"); // Test OTP code
    await page.getByRole("button", { name: "Create account" }).click();

    // Continue with onboarding flow
    await page.waitForURL(/.*\/onboarding.*/u);

    // Fill in personal information
    await page.getByLabel("Legal name").fill(name);
    await page.getByRole("button", { name: "Continue" }).click();

    // Fill in company information
    await page.getByLabel("Company name").fill(companyName);
    await page.getByLabel("Street address").fill(streetAddress);
    await page.getByLabel("City").fill(city);
    await page.getByLabel("State").fill(state);
    await page.getByLabel("ZIP code").fill(zipCode);
    await page.getByRole("button", { name: "Create company" }).click();

    // Verify successful completion
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Verify user was created in database
    const user = await takeOrThrow(
      db.query.users.findFirst({
        where: eq(users.email, email),
        with: { companyAdministrators: { with: { company: true } } },
      }),
    );

    // takeOrThrow ensures user is defined, but TypeScript needs explicit check
    if (!user) {
      throw new Error("User should be defined after takeOrThrow");
    }

    expect(user.email).toBe(email);
    expect(user.legalName).toBe(name);
    expect(user.companyAdministrators).toHaveLength(1);

    // Verify company was created
    const company = user.companyAdministrators[0]?.company;
    expect(company).toBeDefined();
    expect(company?.name).toBe(companyName);
    expect(company?.streetAddress).toBe(streetAddress);
    expect(company?.city).toBe(city);
    expect(company?.state).toBe(state);
    expect(company?.zipCode).toBe(zipCode);
  });
});
