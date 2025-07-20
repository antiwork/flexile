import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendsFactory } from "@test/factories/dividends";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { companies, companyInvestors, users } from "@/db/schema";

test.describe("Investor onboarding - lands on correct page after onboarding completion", () => {
  let company: typeof companies.$inferSelect;
  let onboardingUser: typeof users.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;

  test.beforeEach(async () => {
    company = (await companiesFactory.create()).company;
    const companyAdministrator = (
      await companyAdministratorsFactory.create({
        companyId: company.id,
      })
    ).administrator;

    onboardingUser = (
      await usersFactory.createPreOnboarding({
        countryCode: "US",
        citizenshipCountryCode: "US",
        invitedById: companyAdministrator.userId,
      })
    ).user;

    const result = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: onboardingUser.id,
    });
    companyInvestor = result.companyInvestor;
  });

  test("redirects to empty dividends page when the investor has no dividends", async ({ page }) => {
    await login(page, onboardingUser);

    await page.getByLabel("Full legal name").fill("Wade Wilson");
    await page.getByLabel("Preferred name (visible to others)").fill("Wade");
    await selectComboboxOption(page, "Country of citizenship", "Canada");
    await selectComboboxOption(page, "Country of residence", "Canada");

    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading").getByText("Equity")).toBeVisible();
    await expect(page.getByRole("heading").getByText("Dividends")).toBeVisible();
    await expect(page.getByText("You have not been issued any dividends yet.")).toBeVisible();
  });

  test("redirects to dividends page with data when investor has dividends", async ({ page }) => {
    await dividendsFactory.create({
      companyId: company.id,
      companyInvestorId: companyInvestor.id,
      totalAmountInCents: 75000n,
      status: "Pending signup",
    });

    await login(page, onboardingUser);

    await page.getByLabel("Full legal name").fill("Wade Wilson");
    await page.getByLabel("Preferred name (visible to others)").fill("Wade");
    await selectComboboxOption(page, "Country of citizenship", "Canada");
    await selectComboboxOption(page, "Country of residence", "Canada");

    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/equity\/dividends$/u);
    await expect(page.getByRole("heading").getByText("Equity")).toBeVisible();

    await expect(page.getByText("Please provide your legal details so we can pay you.")).toBeVisible();

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: "$750" })).toBeVisible();
  });
});
