import { expect, test } from "@playwright/test";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendRoundsFactory } from "@test/factories/dividendRounds";
import { dividendsFactory } from "@test/factories/dividends";
import { usersFactory } from "@test/factories/users";
import { wiseRecipientsFactory } from "@test/factories/wiseRecipients";
import { login } from "@test/helpers/auth";

test.describe("Dividend Email Company Selection", () => {
  test("should switch to correct company and show correct dividend amounts when clicking email link", async ({
    page,
  }) => {
    const { company: companyA } = await companiesFactory.createCompletedOnboarding({
      name: "Company Alpha",
      equityEnabled: true,
    });
    const { company: companyB } = await companiesFactory.createCompletedOnboarding({
      name: "Company Beta",
      equityEnabled: true,
    });

    const { user: investorUser } = await usersFactory.create();

    await wiseRecipientsFactory.create({
      userId: investorUser.id,
      usedForDividends: true,
    });

    const { companyInvestor: investorA } = await companyInvestorsFactory.create({
      companyId: companyA.id,
      userId: investorUser.id,
      investmentAmountInCents: BigInt(100000),
    });
    const { companyInvestor: investorB } = await companyInvestorsFactory.create({
      companyId: companyB.id,
      userId: investorUser.id,
      investmentAmountInCents: BigInt(200000),
    });

    const dividendRoundA = await dividendRoundsFactory.create({
      companyId: companyA.id,
      releaseDocument: "Release agreement for Company Alpha",
    });
    const dividendRoundB = await dividendRoundsFactory.create({
      companyId: companyB.id,
      releaseDocument: "Release agreement for Company Beta",
    });

    await dividendsFactory.create({
      companyId: companyA.id,
      companyInvestorId: investorA.id,
      dividendRoundId: dividendRoundA.id,
      totalAmountInCents: BigInt(50000),
      withheldTaxCents: BigInt(5000),
      numberOfShares: BigInt(500),
      status: "Issued",
    });
    await dividendsFactory.create({
      companyId: companyB.id,
      companyInvestorId: investorB.id,
      dividendRoundId: dividendRoundB.id,
      totalAmountInCents: BigInt(75000),
      withheldTaxCents: BigInt(7500),
      numberOfShares: BigInt(750),
      status: "Issued",
    });

    await login(page, investorUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    await expect(page.getByRole("table")).toBeVisible();

    await page.goto(`/equity/dividends?company_id=${companyA.externalId}`);

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: "$500" })).toBeVisible();

    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("company_id");
  });

  test("should handle invalid company_id gracefully", async ({ page }) => {
    const { user: investorUser } = await usersFactory.create();
    const { company } = await companiesFactory.createCompletedOnboarding({ equityEnabled: true });
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorUser.id,
    });

    await login(page, investorUser);

    await page.goto("/equity/dividends?company_id=invalid-id");

    await expect(page.getByRole("table")).toBeVisible();
    await page.waitForTimeout(1000);

    expect(page.url()).not.toContain("company_id");
  });
});
