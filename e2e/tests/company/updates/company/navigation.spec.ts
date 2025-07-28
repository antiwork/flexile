import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Updates sidebar link visibility", () => {
  test("admin sees Updates link if company has investors", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await companyInvestorsFactory.create({ companyId: company.id });
    await login(page, adminUser);
    await expect(page.getByRole("link", { name: "Updates" })).toBeVisible();
  });

  test("admin does NOT see Updates link if company has no investors", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);
    await expect(page.getByRole("link", { name: "Updates" })).not.toBeVisible();
  });

  test("investor always sees Updates link", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const investorUser = (await usersFactory.create()).user;
    await companyInvestorsFactory.create({ companyId: company.id, userId: investorUser.id });
    await login(page, investorUser);
    await expect(page.getByRole("link", { name: "Updates" })).toBeVisible();
  });

  test("contractor sees Updates link if company has investors", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    await companyInvestorsFactory.create({ companyId: company.id });
    const contractorUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({ companyId: company.id, userId: contractorUser.id });

    await login(page, contractorUser);
    await expect(page.getByRole("link", { name: "Updates" })).toBeVisible();
  });
});
