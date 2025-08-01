import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Mobile navigation", () => {
  const mobileViewport = { width: 640, height: 800 };

  test("contractor can navigate via mobile nav menu", async ({ page }) => {
    const { user } = await usersFactory.createContractor();

    await page.setViewportSize(mobileViewport);
    await login(page, user);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).not.toBeVisible();

    await page.getByRole("link", { name: "Back to app" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Payouts" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Tax information" })).not.toBeVisible();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).not.toBeVisible();
  });

  test("administrator can navigate via mobile nav menu", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      requiredInvoiceApprovalCount: 1,
    });

    await page.setViewportSize(mobileViewport);
    await login(page, adminUser);
    await page.goto(`/people`);

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Equity" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Equity" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).not.toBeVisible();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).click();
    await expect(page.getByRole("heading", { name: "Dividends" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Invoices" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Equity" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).not.toBeVisible();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.getByRole("link", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  });
});
