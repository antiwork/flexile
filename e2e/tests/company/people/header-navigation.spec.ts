import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { convertibleSecuritiesFactory } from "@test/factories/convertibleSecurities";
import { dividendsFactory } from "@test/factories/dividends";
import { documentsFactory } from "@test/factories/documents";
import { equityGrantExercisesFactory } from "@test/factories/equityGrantExercises";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";

test.describe("People header navigation", () => {
  const expectedTabs = [
    { name: "Shares", href: "shares" },
    { name: "Exercises", href: "exercises" },
    { name: "Dividends", href: "dividends" },
    { name: "Convertibles", href: "convertibles" },
    { name: "Options", href: "options" },
  ];

  const setup = async () => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await documentsFactory.create({ companyId: company.id });
    const shareClass = (await shareClassesFactory.create({ companyId: company.id })).shareClass;
    await shareHoldingsFactory.create({ companyInvestorId: companyInvestor.id, shareClassId: shareClass.id });
    await equityGrantExercisesFactory.create({ companyInvestorId: companyInvestor.id });
    await equityGrantsFactory.create({ companyInvestorId: companyInvestor.id });
    await dividendsFactory.create({ companyId: company.id, companyInvestorId: companyInvestor.id });
    await convertibleSecuritiesFactory.create({ companyInvestorId: companyInvestor.id });
    return { company, adminUser, companyInvestor };
  };

  const expectTab = async (page: Page, name: string, href: string) => {
    await expect(page.getByRole("tab", { name })).toBeVisible();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("href", `?tab=${href}`);
  };

  test("shows the expected tabs for lawyer", async ({ page }) => {
    const { company, adminUser } = await setup();
    const companyLawyer = (await usersFactory.create()).user;
    await companyLawyersFactory.create({ companyId: company.id, userId: companyLawyer.id });
    await login(page, companyLawyer);
    await page.goto(`/people/${adminUser.externalId}`);

    await expect(page.getByRole("tab", { name: "Details" })).not.toBeVisible();
    for (const { name, href } of expectedTabs) await expectTab(page, name, href);
  });

  test("shows the expected tabs for company administrator", async ({ page }) => {
    const { adminUser } = await setup();
    await login(page, adminUser);
    await page.goto(`/people/${adminUser.externalId}`);

    for (const { name, href } of expectedTabs) await expectTab(page, name, href);
    await expectTab(page, "Details", "details");
  });
});
