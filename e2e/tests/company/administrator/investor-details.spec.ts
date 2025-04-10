import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { documentsFactory } from "@test/factories/documents";
import { userComplianceInfosFactory } from "@test/factories/userComplianceInfos";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Investor details", () => {
  test("shows investor documents", async ({ page }) => {
    const { company } = await companiesFactory.create({
      equityCompensationEnabled: true,
    });
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { user: investor } = await usersFactory.createWithoutComplianceInfo();
    const { userComplianceInfo } = await userComplianceInfosFactory.create({ userId: investor.id });
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor.id,
    });
    await documentsFactory.createTaxDocument(
      {
        companyId: company.id,
        userComplianceInfoId: userComplianceInfo.id,
      },
      { signatures: [{ userId: investor.id, title: "Signer" }], signed: true },
    );

    await login(page, admin);
    await page.goto(`/people/${investor.externalId}`);

    await page.getByRole("tab", { name: "Documents" }).click();
    await expect(page.getByRole("cell", { name: "W-9" })).toBeVisible();
  });
});
