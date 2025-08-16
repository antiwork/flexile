import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { externalProviderMock, fillOtp } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { SignInMethod } from "@/db/enums";
import { users } from "@/db/schema";

test.describe("Company administrator signup", () => {
  test("successfully signs up the company", async ({ page }) => {
    const email = "admin-signup+e2e@example.com";

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

    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Sign up", exact: true }).click();

    await fillOtp(page);

    await page.waitForURL(/.*\/invoices.*/u);

    await page.getByText("Add company details").waitFor();
    await page.getByText("Add company details").click();

    await page.waitForURL(/.*\/settings\/administrator\/details.*/u);

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

test.describe("Google signup", () => {
  test("signup with Google", async ({ page }) => {
    await page.goto("/signup");
    const email = "google-signup+e2e@example.com";

    await externalProviderMock(page, String(SignInMethod.Google), { email });

    await page.getByRole("button", { name: "Sign up with Google" }).click();
    await page.waitForURL(/.*\/invoices.*/u);

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const user = await takeOrThrow(
      db.query.users.findFirst({
        where: eq(users.email, email),
        with: { companyAdministrators: { with: { company: true } } },
      }),
    );

    if (!user) {
      throw new Error("User should be defined after takeOrThrow");
    }

    expect(user.email).toBe(email);
    expect(user.companyAdministrators).toHaveLength(1);
  });

  test("signup with existing user email", async ({ page }) => {
    const { user } = await usersFactory.create();

    await page.goto("/signup");

    await externalProviderMock(page, String(SignInMethod.Google), { email: user.email });

    await page.getByRole("button", { name: "Sign up with Google" }).click();

    await page.waitForURL(/.*\/invoices.*/u);
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(updatedUser?.currentSignInAt).not.toBeNull();
    expect(updatedUser?.currentSignInAt).not.toBe(user.currentSignInAt);
  });
});
