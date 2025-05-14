import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyMonthlyFinancialReportsFactory } from "@test/factories/companyFinancialMonthlyReports";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Company updates page", () => {
  test("year over year financial overview is only shown when there is enough data", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({ companyUpdatesEnabled: true });
    const { user } = await usersFactory.create();
    await companyAdministratorsFactory.create({ companyId: company.id, userId: user.id });

    await companyMonthlyFinancialReportsFactory.createForAYear({
      companyId: company.id,
      year: 2024,
      netIncomeCents: 100_00n,
      revenueCents: 10_00n,
    });

    await companyMonthlyFinancialReportsFactory.create({
      companyId: company.id,
      year: 2023,
      month: 1,
      netIncomeCents: 1_00n,
      revenueCents: 1_00n,
    });
    await companyMonthlyFinancialReportsFactory.create({
      companyId: company.id,
      year: 2023,
      month: 4,
      netIncomeCents: 120_00n,
      revenueCents: 8_00n,
    });

    await login(page, user);
    await page.clock.setFixedTime(new Date("2024-05-21T16:00:00Z"));

    await page.getByRole("link", { name: "Updates" }).click();
    await page.getByRole("link", { name: "New update" }).click();

    const financialOverview = page.locator("div:has(> h2)", { hasText: "Financial overview" }).locator("h2 + div");

    await selectComboboxOption(page, "Financial overview", "Apr 2024 (Last month)");
    await expect(financialOverview).toContainText("Revenue $10 25%", { useInnerText: true });
    await expect(financialOverview).toContainText("Net income $100 -16.67%", { useInnerText: true });

    // doesn't show YoY when there is no data for that period on the previous year
    await selectComboboxOption(page, "Financial overview", "Q1 (Last quarter)");
    await expect(financialOverview).toContainText("Revenue $30", { useInnerText: true });
    await expect(financialOverview).toContainText("Net income $300", { useInnerText: true });
    await expect(financialOverview).not.toContainText("%");

    await companyMonthlyFinancialReportsFactory.create({
      companyId: company.id,
      year: 2023,
      month: 2,
    });
    await companyMonthlyFinancialReportsFactory.create({
      companyId: company.id,
      year: 2023,
      month: 3,
    });

    await page.reload();
    await selectComboboxOption(page, "Financial overview", "Q1 (Last quarter)");
    await expect(financialOverview).toContainText("Revenue $30", { useInnerText: true });
    await expect(financialOverview).toContainText("Net income $300", { useInnerText: true });
    await expect(financialOverview).toContainText("%");

    // don't show the financial overview when we don't have all the data for the period
    await selectComboboxOption(page, "Financial overview", "2023 (Last year)");
    await expect(financialOverview).not.toBeVisible();
  });
});
