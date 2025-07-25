import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Cap Table", () => {
  test("displays correct ownership percentages for investors", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      capTableEnabled: true,
      fullyDilutedShares: BigInt(1000000),
    });

    const { user: investor1 } = await usersFactory.create({ legalName: "Alice Investor" });
    const { companyInvestor: companyInvestor1 } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor1.id,
    });
    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor1.id,
      numberOfShares: 100000,
      shareHolderName: "Alice Investor",
    });

    const { user: investor2 } = await usersFactory.create({ legalName: "Bob Investor" });
    const { companyInvestor: companyInvestor2 } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor2.id,
    });
    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor2.id,
      numberOfShares: 50000,
      shareHolderName: "Bob Investor",
    });

    await login(page, adminUser);
    await page.goto("/equity/cap_table");

    await expect(page.getByText("Cap table")).toBeVisible();
    await expect(page.getByText("Alice Investor")).toBeVisible();
    await expect(page.getByText("Bob Investor")).toBeVisible();

    await expect(page.locator("tbody")).toContainText("10.00%");
    await expect(page.locator("tbody")).toContainText("5.00%");

    await expect(page.locator("tbody")).toContainText("100,000");
    await expect(page.locator("tbody")).toContainText("50,000");
  });

  test("recalculates ownership percentages when data changes", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      capTableEnabled: true,
      fullyDilutedShares: BigInt(1000000),
    });

    const { user: investor } = await usersFactory.create({ legalName: "Test Investor" });
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor.id,
    });
    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      numberOfShares: 200000,
      shareHolderName: "Test Investor",
    });

    await login(page, adminUser);
    await page.goto("/equity/cap_table");

    await expect(page.getByText("Test Investor")).toBeVisible();
    await expect(page.locator("tbody")).toContainText("20.00%");
    await expect(page.locator("tbody")).toContainText("200,000");
  });

  test("shows correct ownership percentages for both outstanding and fully diluted columns", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      capTableEnabled: true,
      fullyDilutedShares: BigInt(2000000),
    });

    const { user: investor } = await usersFactory.create({ legalName: "Major Investor" });
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor.id,
    });
    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      numberOfShares: 300000,
      shareHolderName: "Major Investor",
    });

    await login(page, adminUser);
    await page.goto("/equity/cap_table");

    await expect(page.getByText("Major Investor")).toBeVisible();
    await expect(page.locator("tbody")).toContainText("15.00%");
    await expect(page.locator("tbody")).toContainText("300,000");

    const tableHeaders = page.locator("thead th");
    await expect(tableHeaders).toContainText("Outstanding ownership");
    await expect(tableHeaders).toContainText("Fully diluted ownership");
  });
});
