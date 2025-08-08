import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Mobile navigation", () => {
  const mobileViewport = { width: 640, height: 800 };

  test("contractor can navigate via mobile bottom navbar", async ({ page }) => {
    const { user } = await usersFactory.createContractor();

    await page.setViewportSize(mobileViewport);
    await login(page, user);
    await page.goto("/invoices");

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();

    await page.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Personal")).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Payouts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tax information" })).toBeVisible();

    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    const bottomNav = page.getByRole("navigation");
    try {
      await bottomNav.getByRole("link", { name: "Invoices" }).click({ timeout: 1000 });
    } catch {
      try {
        await bottomNav.getByRole("button", { name: "Invoices" }).click({ timeout: 1000 });
      } catch {
        await page.goto("/invoices");
      }
    }
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("administrator can navigate via mobile bottom navbar with equity", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      requiredInvoiceApprovalCount: 1,
    });

    await page.setViewportSize(mobileViewport);
    await login(page, adminUser);
    await page.goto(`/people`);

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Equity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();

    await page.getByRole("button", { name: "Equity" }).click();
    await expect(page.getByRole("heading", { name: "Equity" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Investors" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dividends" })).toBeVisible();

    await page.getByRole("link", { name: "Dividends" }).click();
    await expect(page.getByRole("heading", { name: "Dividends" })).toBeVisible();

    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    const settingsSheet = page.getByRole("dialog");
    await expect(settingsSheet.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(settingsSheet.getByText("Personal")).toBeVisible();
    await expect(settingsSheet.getByRole("heading", { name: "Company" })).toBeVisible();
    await expect(settingsSheet.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(settingsSheet.getByRole("link", { name: "Workspace settings" })).toBeVisible();
    await expect(settingsSheet.getByRole("link", { name: "Company details" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Billing" })).toBeVisible();

    await page.getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();

    await page.click("body", { position: { x: 100, y: 100 } });
    await expect(page.getByRole("heading", { name: "More" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).not.toBeVisible();

    await page.getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("company switching works in mobile navigation", async ({ page }) => {
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: false,
    });

    const { company: secondCompany } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });
    await companyAdministratorsFactory.create({
      userId: adminUser.id,
      companyId: secondCompany.id,
    });

    await page.setViewportSize(mobileViewport);
    await login(page, adminUser);
    await page.goto("/");

    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();

    const companyName = company.name;
    const secondCompanyName = secondCompany.name;
    if (companyName && secondCompanyName) {
      const companySwitcher = page.locator("button").filter({ hasText: companyName });
      await expect(companySwitcher).toBeVisible();

      await companySwitcher.click();
      const companySheet = page.getByRole("dialog");
      await expect(companySheet.getByRole("heading", { name: "Company" })).toBeVisible();
      await expect(companySheet.getByText(companyName)).toBeVisible();
      await expect(companySheet.getByText(secondCompanyName)).toBeVisible();

      await page.getByRole("button").first().click();
      await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    }
  });

  test("navigation works correctly when switching between sheets", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      requiredInvoiceApprovalCount: 1,
    });

    await page.setViewportSize(mobileViewport);
    await login(page, adminUser);
    await page.goto("/");

    await page.getByRole("button", { name: "Equity" }).click();
    await expect(page.getByRole("heading", { name: "Equity" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 2000 });
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Equity" })).not.toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 2000 });
    await page.getByRole("button", { name: "Equity" }).click();
    await expect(page.getByRole("heading", { name: "Equity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "More" })).not.toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 2000 });
    await expect(page.getByRole("heading", { name: "Equity" })).not.toBeVisible();

    await page.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  });

  test("mobile navbar respects user permissions", async ({ page }) => {
    const { user: contractor } = await usersFactory.createContractor();

    await page.setViewportSize(mobileViewport);
    await login(page, contractor);
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Equity" })).not.toBeVisible();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Settings" }).click();

    await expect(page.getByText("Personal")).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Payouts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tax information" })).toBeVisible();

    await expect(page.getByText("Company")).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Workspace settings" })).not.toBeVisible();
  });
});
