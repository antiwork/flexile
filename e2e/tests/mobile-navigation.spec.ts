import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";

test.describe("Mobile navigation", () => {
  const mobileViewport = { width: 640, height: 800 };
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      requiredInvoiceApprovalCount: 1,
    });
    company = result.company;
    adminUser = result.adminUser;

    await companyInvestorsFactory.create({ companyId: company.id });
  });

  test("contractor can navigate via mobile nav menu", async ({ page }) => {
    const user = (await usersFactory.create()).user;
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    await page.setViewportSize(mobileViewport);
    await login(page, user);

    const navigation = page.getByRole("navigation");

    await expect(navigation.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Updates" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "More" })).toBeVisible();

    await navigation.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await navigation.getByRole("link", { name: "Updates" }).click();
    await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();

    await navigation.getByRole("button", { name: "More" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "More" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Settings" })).toBeVisible();
        await expect(modal.getByText("Log out")).toBeVisible();

        await modal.getByRole("link", { name: "Settings" }).click();
      },
      { page, title: "More" },
    );
    await expect(page.getByRole("dialog", { name: "More" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    await expect(navigation.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Personal" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Company" })).not.toBeVisible();

    await navigation.getByRole("button", { name: "Personal" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("link", { name: "Profile" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Payouts" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Tax information" })).toBeVisible();

        await modal.getByRole("link", { name: "Payouts" }).click();
      },
      { page, title: "Personal" },
    );
    await expect(page.getByRole("dialog", { name: "Personal" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Payouts" })).toBeVisible();

    await navigation.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("administrator can navigate via mobile nav menu", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await login(page, adminUser);
    await page.goto(`/people`);

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    const navigation = page.getByRole("navigation");

    await expect(navigation.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Equity" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "More" })).toBeVisible();

    await navigation.getByRole("button", { name: "Equity" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("link", { name: "Investors" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Option pools" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Equity grants" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Dividends" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Buybacks" })).toBeVisible();

        await modal.getByRole("link", { name: "Dividends" }).click();
      },
      { page, title: "Equity" },
    );
    await expect(page.getByRole("dialog", { name: "Equity" })).not.toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" }).getByText("Dividends")).toBeVisible();

    await navigation.getByRole("button", { name: "More" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "More" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Updates" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "People" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Settings" })).toBeVisible();
        await expect(modal.getByText("Log out")).toBeVisible();

        await modal.getByRole("link", { name: "Settings" }).click();
      },
      { page, title: "More" },
    );
    await expect(page.getByRole("dialog", { name: "More" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    await expect(navigation.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Personal" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Company" })).toBeVisible();

    await navigation.getByRole("button", { name: "Company" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("link", { name: "Workspace settings" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Workspace admins" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Company details" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Billing" })).toBeVisible();
        await expect(modal.getByRole("link", { name: "Equity" })).toBeVisible();

        await modal.getByRole("link", { name: "Billing" }).click();
      },
      { page, title: "Company" },
    );
    await expect(page.getByRole("dialog", { name: "Company" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();

    await navigation.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });
});
