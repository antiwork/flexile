import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, users } from "@/db/schema";

test.describe("Company administrator onboarding - company details", () => {
  test("allows setting the company's details", async ({ page }) => {
    const { company } = await companiesFactory.createPreOnboarding();
    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const admin = await db.query.users
      .findFirst({
        where: eq(users.id, administrator.userId),
      })
      .then(takeOrThrow);

    await login(page, admin);
    await page.goto(`/companies/${company.externalId}/administrator/onboarding/details`);

    await expect(page.getByText("Set up your company")).toBeVisible();
    await expect(page.getByText("We'll use this information to create contracts and bill you.")).toBeVisible();

    await page.getByLabel("Your full legal name").fill("");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Your full legal name")).not.toBeValid();
    await expect(page.getByText("This doesn't look like a complete full name")).toBeVisible();

    const adminName = faker.person.fullName();
    const companyName = faker.company.name();
    const streetAddress = faker.location.streetAddress();
    const city = faker.location.city();
    const state = "Missouri";
    const zipCode = faker.location.zipCode();

    await page.getByLabel("Your full legal name").fill(adminName);
    await page.getByLabel("Your company's legal name").fill(companyName);
    await page.getByLabel("Street address, apt number").fill(streetAddress);
    await page.getByLabel("City").fill(city);
    await selectComboboxOption(page, "State", state);
    await page.getByLabel("ZIP code").fill(zipCode);

    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Link your bank account")).toBeVisible();

    // Verify data was saved
    const updatedAdmin = await db.query.users
      .findFirst({
        where: eq(users.id, admin.id),
      })
      .then(takeOrThrow);
    expect(updatedAdmin.legalName).toBe(adminName);

    const updatedCompany = await db.query.companies
      .findFirst({
        where: eq(companies.id, company.id),
      })
      .then(takeOrThrow);
    expect(updatedCompany).toMatchObject({
      name: companyName,
      streetAddress,
      city,
      state: "MO",
      zipCode,
    });
  });
});
