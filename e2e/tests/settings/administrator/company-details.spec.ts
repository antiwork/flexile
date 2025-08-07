import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, type users } from "@/db/schema";

test.describe("Company details", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding();
    company = result.company;
    adminUser = result.adminUser;
  });

  test("allows updating company details", async ({ page }) => {
    const companyFillData = {
      name: "Updated Company Legal Name",
      taxId: "771111129",
      phoneNumber: "2154567890",
      streetAddress: "61206 Wyman Centers",
      city: "East Hartford",
      state: "Mississippi",
      zipCode: "38745",
    };

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Company details" }).click();

    await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();
    await expect(
      page.getByText("These details will be included in tax forms, as well as in your contractor's invoices."),
    ).toBeVisible();
    await expect(page.getByText("Flexile is only available for companies based in the United States.")).toBeVisible();

    const companyLegalNameLocator = page.getByLabel("Company's legal name");
    const EINLocator = page.getByLabel("EIN");
    const phoneNumberLocator = page.getByLabel("Phone number");
    const streetAddressLocator = page.getByLabel("Residential address (street name, number, apt)");
    const cityLocator = page.getByLabel("City or town");
    const zipCodeLocator = page.getByLabel("ZIP code");

    await expect(companyLegalNameLocator).toHaveValue(company.name ?? "");
    await expect(EINLocator).toHaveValue(company.taxId ?? "");
    await expect(phoneNumberLocator).toHaveValue(company.phoneNumber ?? "");
    await expect(streetAddressLocator).toHaveValue(company.streetAddress ?? "");
    await expect(cityLocator).toHaveValue(company.city ?? "");
    await expect(zipCodeLocator).toHaveValue(company.zipCode ?? "");

    await companyLegalNameLocator.fill(companyFillData.name);
    await EINLocator.fill(companyFillData.taxId);
    await phoneNumberLocator.fill(companyFillData.phoneNumber);
    await streetAddressLocator.fill(companyFillData.streetAddress);
    await cityLocator.fill(companyFillData.city);
    await selectComboboxOption(page, "State", companyFillData.state);
    await zipCodeLocator.fill(companyFillData.zipCode);

    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Changes saved")).toBeVisible();

    const updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });

    expect(updatedCompany).toMatchObject({
      ...companyFillData,
      taxId: "77-1111129",
      phoneNumber: "(215) 456-7890",
      state: "MS",
    });
  });

  test("shows validation errors for invalid data", async ({ page }) => {
    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Company details" }).click();

    const EINLocator = page.getByLabel("EIN");
    const phoneNumberLocator = page.getByLabel("Phone number");

    await page.getByLabel("Company's legal name").fill("");
    await EINLocator.fill("");
    await phoneNumberLocator.fill("");
    await page.getByLabel("Residential address (street name, number, apt)").fill("");
    await page.getByLabel("City or town").fill("");
    await page.getByLabel("ZIP code").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("This field is required.")).toHaveCount(5);
    await expect(page.getByText("Please check that your EIN is 9 numbers long.")).toBeVisible();

    await EINLocator.fill("111111111");

    await expect(page.getByText("Your EIN can't have all identical digits.")).toBeVisible();

    await EINLocator.fill("7711131");

    await expect(page.getByText("Please check that your EIN is 9 numbers long.")).toBeVisible();

    await phoneNumberLocator.fill("123456789");

    await expect(page.getByText("Please enter a valid U.S. phone number.")).toBeVisible();
  });

  test("redirects non-admin users", async ({ page }) => {
    const user = (await usersFactory.create()).user;
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    await login(page, user);
    await page.getByRole("link", { name: "Settings" }).click();

    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Company details" })).not.toBeVisible();

    await page.goto("/settings/administrator/details");

    await expect(page.getByText("Access denied", { exact: true })).toBeVisible();
  });
});
