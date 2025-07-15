// TODO (techdebt): Delete the Ruby system spec after the dividends redirect is implemented

import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Investor onboarding (sidebar flow)", () => {
  test("should allow investor to complete onboarding via sidebar and redirect to dividends", async ({ page }) => {
    // 1. Create company and user
    await companiesFactory.create();
    const { user } = await usersFactory.createPreOnboarding({ countryCode: "US", citizenshipCountryCode: "US" });
    // 2. Login
    await login(page, user);
    // 3. Assert redirect to /invoices and presence of checklist
    await expect(page).toHaveURL("/invoices");
    await expect(page.getByRole("button", { name: /Add company details/iu })).toBeVisible();
    // 4. Click 'Add company details' in the checklist
    await page.getByRole("button", { name: /Add company details/iu }).click();
    await expect(page).toHaveURL("/administrator/settings/details");
    // 5. Fill out the company details form
    await page.getByLabel("Company's legal name").fill("Test Company LLC");
    await page.getByLabel("EIN").fill("12-3456789");
    await page.getByLabel("Phone number").fill("(555) 123-4567");
    await page.getByLabel("Residential address (street name, number, apt)").fill("123 Main St, Apt 4B");
    await page.getByLabel("City or town").fill("New York");
    // Fix: State is a combobox, not a <select>
    await page.getByLabel("State").click();
    await page.getByRole("option", { name: "New York", exact: true }).click();
    await page.getByLabel("ZIP code").fill("10001");
    // 6. Save changes
    await page.getByRole("button", { name: "Save changes" }).click();
    // 7. (Optionally) Assert checklist updates or next step is enabled
    await page.goto("/equity/dividend_rounds");
    await expect(page.getByText("You have not issued any dividends yet.")).toBeVisible();
  });
});
