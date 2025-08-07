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

    const companyName = faker.company.name();
    const ein = faker.string.numeric(9); // 9-digit EIN
    const phoneNumber = faker.string.numeric(10); // 10-digit phone
    const streetAddress = faker.location.streetAddress();
    const city = faker.location.city();
    const stateCode = "CA"; // Use fixed state code
    const stateName = "California"; // Use fixed state name
    const zipCode = faker.location.zipCode();

    await page.goto("/signup");

    // Enter email and request OTP
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Sign up" }).click();

    // Wait for OTP step and enter verification code
    // The form should auto-submit when all 6 digits are entered
    const otpCode = "000000";
    await page.locator('[data-slot="input-otp"]').fill(otpCode);

    // No need to click the button as it should auto-submit
    // Wait for redirect to dashboard
    await page.waitForURL(/.*\/invoices.*/u);

    // Wait for getting started sidebar to be visible and click on the first incomplete item
    await page.getByText("Add company details").waitFor();
    await page.getByText("Add company details").click();

    // Wait for company details page to load
    await page.waitForURL(/.*\/settings\/administrator\/details.*/u);

    // Fill in company details
    await page.getByLabel("Company's legal name").fill(companyName);
    await page.getByLabel("EIN").fill(ein);
    await page.getByLabel("Phone number").fill(phoneNumber);
    await page.getByLabel("Residential address (street name, number, apt)").fill(streetAddress);
    await page.getByLabel("City or town").fill(city);
    await page.getByLabel("State").click();
    await page.getByText(stateName).click();
    await page.getByLabel("ZIP code").fill(zipCode);
    await page.getByRole("button", { name: "Save changes" }).click();

    // Wait for save to complete and verify we're back on the page
    await expect(page.getByText("Changes saved")).toBeVisible();

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
    expect(user.companyAdministrators).toHaveLength(1);

    // Verify company was created with the updated details
    const company = user.companyAdministrators[0]?.company;
    expect(company).toBeDefined();
    expect(company?.name).toBe(companyName);
    expect(company?.streetAddress).toBe(streetAddress);
    expect(company?.city).toBe(city);
    expect(company?.state).toBe(stateCode);
    expect(company?.zipCode).toBe(zipCode);
  });
});
