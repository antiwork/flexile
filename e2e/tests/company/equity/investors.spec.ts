import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companyInvestors } from "@/db/schema";

test.describe("Investors", () => {
  test("displays correct ownership percentages for investors", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
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
    await db
      .update(companyInvestors)
      .set({ totalShares: BigInt(100000) })
      .where(eq(companyInvestors.id, companyInvestor1.id));

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
    await db
      .update(companyInvestors)
      .set({ totalShares: BigInt(50000) })
      .where(eq(companyInvestors.id, companyInvestor2.id));

    await login(page, adminUser, "/equity/investors");
    await expect(page.getByText("Investors")).toBeVisible();
    await expect(page.getByText("Alice Investor")).toBeVisible();
    await expect(page.getByText("Bob Investor")).toBeVisible();

    await expect(page.locator("tbody")).toContainText("10.00%");
    await expect(page.locator("tbody")).toContainText("5.00%");

    await expect(page.locator("tbody")).toContainText("100,000");
    await expect(page.locator("tbody")).toContainText("50,000");
  });

  test("recalculates ownership percentages when data changes", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
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
    await db
      .update(companyInvestors)
      .set({ totalShares: BigInt(200000) })
      .where(eq(companyInvestors.id, companyInvestor.id));

    await login(page, adminUser, "/equity/investors");

    await expect(page.getByText("Test Investor")).toBeVisible();
    await expect(page.locator("tbody")).toContainText("20.00%");
    await expect(page.locator("tbody")).toContainText("200,000");
  });

  test("shows correct ownership percentages for both outstanding and fully diluted columns", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
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
    await db
      .update(companyInvestors)
      .set({ totalShares: BigInt(300000) })
      .where(eq(companyInvestors.id, companyInvestor.id));

    await login(page, adminUser, "/equity/investors");

    await expect(page.getByText("Major Investor")).toBeVisible();
    await expect(page.locator("tbody")).toContainText("15.00%");
    await expect(page.locator("tbody")).toContainText("300,000");

    await expect(page.getByRole("cell", { name: "Outstanding ownership" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fully diluted ownership" })).toBeVisible();
  });

  test.describe("Column Settings", () => {
    test("shows and hides columns properly", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
        equityEnabled: true,
        fullyDilutedShares: BigInt(1000000),
      });
      const { shareClass: commonClass } = await shareClassesFactory.create({
        companyId: company.id,
        name: "Common",
      });
      const { optionPool } = await optionPoolsFactory.create({
        companyId: company.id,
        shareClassId: commonClass.id,
      });
      const { user: investor } = await usersFactory.create({ legalName: "Test Investor" });
      const { companyInvestor } = await companyInvestorsFactory.create({
        companyId: company.id,
        userId: investor.id,
      });
      await shareHoldingsFactory.create({
        companyInvestorId: companyInvestor.id,
        shareClassId: commonClass.id,
        numberOfShares: 60000,
        shareHolderName: "Test Investor",
      });

      await equityGrantsFactory.create({
        companyInvestorId: companyInvestor.id,
        optionPoolId: optionPool.id,
        exercisePriceUsd: "1.00",
        vestedShares: 3000,
        unvestedShares: 2000,
      });
      await db
        .update(companyInvestors)
        .set({ totalShares: BigInt(60000) })
        .where(eq(companyInvestors.id, companyInvestor.id));

      await login(page, adminUser);
      await page.goto("/equity/investors");

      await expect(page.getByRole("table")).toBeVisible();
      await expect(page.getByText("Test Investor")).toBeVisible();

      await expect(page.getByRole("button", { name: /Columns \d+/u })).toBeVisible();

      // Default columns are visible by default
      await expect(page.locator("thead").getByText("Name")).toBeVisible();
      await expect(page.locator("thead").getByText("Outstanding shares")).toBeVisible();
      await expect(page.locator("thead").getByText("Outstanding ownership")).toBeVisible();
      await expect(page.locator("thead").getByText("Fully diluted shares")).toBeVisible();
      await expect(page.locator("thead").getByText("Fully diluted ownership")).toBeVisible();

      await page.getByRole("button", { name: /Columns/u }).click();
      await page.getByRole("menuitem", { name: "Ownership" }).hover();
      const nameCheckbox = page.getByRole("menuitemcheckbox", { name: "Name" });
      await expect(nameCheckbox).toBeDisabled();
      await expect(nameCheckbox).toBeChecked();

      // Toggle outstanding ownership column
      await page.getByRole("menuitemcheckbox", { name: "Outstanding ownership" }).click();
      await expect(page.locator("thead").getByText("Outstanding ownership")).not.toBeVisible();
      await expect(page.locator("thead").getByText("Name")).toBeVisible();
      await expect(page.locator("thead").getByText("Outstanding shares")).toBeVisible();

      // Persists column settings on page refresh
      await page.reload();
      await expect(page.getByRole("table")).toBeVisible();
      await expect(page.locator("thead").getByText("Outstanding ownership")).not.toBeVisible();
      await expect(page.locator("thead").getByText("Name")).toBeVisible();

      // Test new share class and option columns
      await page.getByRole("button", { name: /Columns/u }).click();
      await page.getByRole("menuitem", { name: "Share classes" }).hover();
      await page.getByRole("menuitemcheckbox", { name: "Common" }).click();
      await page.getByRole("button", { name: /Columns/u }).click();
      await page.getByRole("menuitem", { name: "Option strikes" }).hover();
      await page.getByRole("menuitemcheckbox", { name: "Common options $1.00 strike" }).click();
      await expect(page.locator("tbody")).toContainText("60,000"); // Common shares
      await expect(page.locator("tbody")).toContainText("5,000"); // $1.00 options
    });

    test("hides column settings button when no data", async ({ page }) => {
      const { adminUser } = await companiesFactory.createCompletedOnboarding({
        equityEnabled: true,
        fullyDilutedShares: BigInt(1000000),
      });

      await login(page, adminUser);
      await page.goto("/equity/investors");

      await expect(page.getByRole("button", { name: /Columns/u })).not.toBeVisible();
    });
  });
});
