import { expect, test } from "@playwright/test";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyUpdatesFactory } from "@test/factories/companyUpdates";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { withinModal } from "@test/index";

test.describe("view company updates", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];
  let user: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  const adminUserpreferredName = "Test Admin";

  test.beforeEach(async () => {
    const result = await companiesFactory.create();
    company = result.company;
    adminUser = (await usersFactory.create({ preferredName: adminUserpreferredName })).user;
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });
    user = (await usersFactory.create()).user;
    // Add an investor so company updates are available
    await companyInvestorsFactory.create({ companyId: company.id });
  });

  test("contractor view updates", async ({ page }) => {
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    const { companyUpdate } = await companyUpdatesFactory.createPublished({
      companyId: company.id,
      title: "Company Update: Contractor View",
      body: "<p>Test contractor view content for body.</p>",
      sentAt: new Date(),
    });

    await login(page, user);
    await page.goto(`/updates/company`);

    await page.getByRole("row").getByText(companyUpdate.title).first().click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByText("Test contractor view content for body.")).toBeVisible();
        await expect(modal.getByText(adminUserpreferredName)).toBeVisible();
      },
      { page, title: companyUpdate.title },
    );
  });

  test("investor view updates", async ({ page }) => {
    await companyInvestorsFactory.create({ companyId: company.id, userId: user.id });
    const { companyUpdate } = await companyUpdatesFactory.createPublished({
      companyId: company.id,
      title: "Company Update: Investor View",
      body: "<p>Test investor view content for body.</p>",
      sentAt: new Date(),
    });

    await login(page, user);
    await page.goto(`/updates/company`);

    await page.getByRole("row").getByText(companyUpdate.title).first().click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByText("Test investor view content for body.")).toBeVisible();
        await expect(modal.getByText(adminUserpreferredName)).toBeVisible();
      },
      { page, title: companyUpdate.title },
    );
  });
});
