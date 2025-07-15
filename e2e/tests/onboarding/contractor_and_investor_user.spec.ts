// TODO (techdebt): Delete the Ruby system spec after full Playwright migration

import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendRoundsFactory } from "@test/factories/dividendRounds";
import { dividendsFactory } from "@test/factories/dividends";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Contractor and investor onboarding (no contract)", () => {
  test("should show empty invoices page and dividends page after onboarding", async ({ page }) => {
    // 1. Create company and user
    const { company } = await companiesFactory.create();
    const { user } = await usersFactory.create({ countryCode: "US", citizenshipCountryCode: "US" });
    // 2. Assign all roles, no contract
    await companyAdministratorsFactory.create({ companyId: company.id, userId: user.id });
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });
    const { companyInvestor } = await companyInvestorsFactory.create({ companyId: company.id, userId: user.id });

    // Add a dividend for this user as an investor
    const dividendRound = await dividendRoundsFactory.create({ companyId: company.id });
    await dividendsFactory.create({
      companyId: company.id,
      companyInvestorId: companyInvestor.id,
      dividendRoundId: dividendRound.id,
      totalAmountInCents: 50000n,
    });
    // 3. Login
    await login(page, user);
    // 4. Complete onboarding checklist (add company details)
    await expect(page).toHaveURL("/invoices");

    // Assert the contractor rate field is visible
    await expect(page.getByLabel("Rate")).toBeVisible();
    await expect(page.getByRole("group", { name: "Invoice date" })).toBeVisible();

    // Optionally, still check for 'No invoices to display.'
    await expect(page.getByText("No invoices to display.")).toBeVisible();

    // Navigate directly to the dividends page
    await page.goto("/equity/dividend_rounds");
    await expect(page).toHaveURL("/equity/dividend_rounds");
    // Assert a dividend is visible (not the empty state)
    await expect(page.getByText("$1,000")).toBeVisible();
  });
});
