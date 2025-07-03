import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantExercisesFactory } from "@test/factories/equityGrantExercises";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("People - Exercises Table", () => {
  test("displays option grant IDs and stock certificate IDs in exercises table", async ({ page }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { user: contractorUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    const { equityGrant, shareHolding } = await equityGrantExercisesFactory.create({
      companyInvestorId: companyInvestor.id,
      status: "signed",
    }, { withShareHoldings: true });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractorUser.preferredName ?? "" }).click();
    
    await page.goto(`/people/${contractorUser.externalId}?tab=exercises`);

    await expect(page.getByRole("table")).toBeVisible();
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(2);

    const dataRow = rows.nth(1);
    
    await expect(dataRow).toContainText(equityGrant.name);
    
    if (shareHolding) {
      await expect(dataRow).toContainText(shareHolding.name);
    }
    
    await expect(dataRow).toContainText("100");
    await expect(dataRow).toContainText("$50");
    await expect(dataRow).toContainText("Signed");
  });

  test("displays '—' for stock certificate ID when share holding doesn't exist", async ({ page }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { user: contractorUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    const { equityGrant } = await equityGrantExercisesFactory.create({
      companyInvestorId: companyInvestor.id,
      status: "signed",
    }, { withShareHoldings: false });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractorUser.preferredName ?? "" }).click();
    
    await page.goto(`/people/${contractorUser.externalId}?tab=exercises`);

    await expect(page.getByRole("table")).toBeVisible();
    const rows = page.getByRole("table").getByRole("row");
    const dataRow = rows.nth(1);
    
    await expect(dataRow).toContainText(equityGrant.name);
    
    await expect(dataRow).toContainText("—");
  });
});
