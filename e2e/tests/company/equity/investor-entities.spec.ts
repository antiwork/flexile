import { companiesFactory } from "@test/factories/companies";
import { companyInvestorEntitiesFactory } from "@test/factories/companyInvestorEntities";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Investor Entities", () => {
  test("displays investor entity details with grants and shares", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fullyDilutedShares: BigInt(1000000),
    });

    const { user: investorUser } = await usersFactory.create({
      legalName: "Test Investor",
    });
    await companyInvestorsFactory.create({
      id: investorUser.id,
      companyId: company.id,
      userId: investorUser.id,
    });

    const { companyInvestorEntity } = await companyInvestorEntitiesFactory.create({
      id: investorUser.id,
      companyId: company.id,
      name: "Test Investor",
    });

    const { shareClass } = await shareClassesFactory.create({
      companyId: company.id,
      name: "Common Stock",
    });

    await shareHoldingsFactory.create({
      companyInvestorEntityId: companyInvestorEntity.id,
      shareClassId: shareClass.id,
      name: "Common Stock",
      numberOfShares: 50000,
      issuedAt: new Date("2023-01-15"),
      originallyAcquiredAt: new Date("2023-01-15"),
      totalAmountInCents: BigInt(25000000),
      sharePriceUsd: "5.00",
      shareHolderName: "Test Investor",
    });

    await equityGrantsFactory.create({
      companyInvestorId: investorUser.id,
      companyInvestorEntityId: companyInvestorEntity.id,
      numberOfShares: 10000,
      vestedShares: 8000,
      unvestedShares: 2000,
      exercisedShares: 1000,
      exercisePriceUsd: "2.50",
      issuedAt: new Date("2023-06-01"),
    });

    await login(
      page,
      adminUser,
      `/companies/${company.externalId}/investor_entities/${companyInvestorEntity.externalId}?tab=shares`,
    );

    await expect(page.getByRole("heading", { name: "Test Investor" })).toBeVisible();

    await expect(page.getByRole("tab", { name: "Shares", selected: true })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Common Stock");
    await expect(page.locator("tbody")).toContainText("50,000");
    await expect(page.locator("tbody")).toContainText("$5");
    await expect(page.locator("tbody")).toContainText("$250,000");

    await page.getByRole("tab", { name: "Options" }).click();
    await expect(page.getByRole("tab", { name: "Options", selected: true })).toBeVisible();

    await expect(page.locator("tbody")).toContainText("10,000");
    await expect(page.locator("tbody")).toContainText("8,000");
    await expect(page.locator("tbody")).toContainText("2,000");
    await expect(page.locator("tbody")).toContainText("1,000");
    await expect(page.locator("tbody")).toContainText("$2.50");
  });

  test("shows empty state when no grants or shares exist", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { companyInvestorEntity } = await companyInvestorEntitiesFactory.create({
      companyId: company.id,
      name: "Empty Investor",
    });

    await login(
      page,
      adminUser,
      `/companies/${company.externalId}/investor_entities/${companyInvestorEntity.externalId}?tab=shares`,
    );

    await expect(page.getByRole("heading", { name: "Empty Investor" })).toBeVisible();
    await expect(page.getByText("This investor entity does not hold any shares.")).toBeVisible();

    await page.getByRole("tab", { name: "Options" }).click();
    await expect(page.getByText("This investor entity does not have any option grants.")).toBeVisible();
  });

  test("is accessible by company administrators", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { companyInvestorEntity } = await companyInvestorEntitiesFactory.create({
      companyId: company.id,
      name: "Admin Test",
    });

    await login(
      page,
      adminUser,
      `/companies/${company.externalId}/investor_entities/${companyInvestorEntity.externalId}`,
    );

    await expect(page.getByRole("heading", { name: "Admin Test" })).toBeVisible();
  });

  test("is accessible by company lawyers", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: lawyerUser } = await usersFactory.create();
    await companyLawyersFactory.create({
      companyId: company.id,
      userId: lawyerUser.id,
    });

    const { companyInvestorEntity } = await companyInvestorEntitiesFactory.create({
      companyId: company.id,
      name: "Lawyer Test",
    });

    await login(
      page,
      lawyerUser,
      `/companies/${company.externalId}/investor_entities/${companyInvestorEntity.externalId}`,
    );

    await expect(page.getByRole("heading", { name: "Lawyer Test" })).toBeVisible();
  });

  test("is not accessible by regular users", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: regularUser } = await usersFactory.create();
    const { companyInvestorEntity } = await companyInvestorEntitiesFactory.create({
      companyId: company.id,
      name: "Forbidden Test",
    });

    await login(
      page,
      regularUser,
      `/companies/${company.externalId}/investor_entities/${companyInvestorEntity.externalId}`,
    );

    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("returns 404 for non-existent investor entity", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    await login(page, adminUser, `/companies/${company.externalId}/investor_entities/nonexistent`);

    await expect(page.getByText("Something went wrong")).toBeVisible();
  });
});
