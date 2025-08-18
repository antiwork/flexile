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

    // Check that bottom nav items are visible
    const bottomNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(bottomNav).toBeVisible();

    // Main nav items should be visible in bottom nav
    await expect(bottomNav.getByRole("listitem", { name: "Invoices" })).toBeVisible();
    await expect(bottomNav.getByRole("listitem", { name: "Documents" })).toBeVisible();
    await expect(bottomNav.getByRole("listitem", { name: "Settings" })).toBeVisible();
    await expect(bottomNav.getByRole("listitem", { name: "More" })).toBeVisible();

    // Click on Documents link
    await bottomNav.getByRole("link").filter({ hasText: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    // Navigate to Settings
    await bottomNav.getByRole("button", { name: "Settings menu" }).click();
    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tax information" })).toBeVisible();

    // Click on More button to open overflow menu
    await bottomNav.getByRole("button", { name: "More" }).click();

    // Check that overflow menu items are visible
    await expect(page.getByRole("link", { name: "Support center" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("administrator can navigate via mobile nav menu", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      requiredInvoiceApprovalCount: 1,
    });

    await page.setViewportSize(mobileViewport);
    await login(page, adminUser);

    // Check that bottom nav items are visible
    const bottomNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(bottomNav).toBeVisible();

    // Main nav items should be visible in bottom nav (Invoices, Documents, Equity are prioritized)
    await expect(bottomNav.getByRole("listitem", { name: "Invoices" })).toBeVisible();
    await expect(bottomNav.getByRole("listitem", { name: "Documents" })).toBeVisible();
    await expect(bottomNav.getByRole("listitem", { name: "Equity" })).toBeVisible();
    await expect(bottomNav.getByRole("listitem", { name: "More" })).toBeVisible();

    // Navigate to Invoices
    // Click on Documents link
    await bottomNav.getByRole("link").filter({ hasText: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    // Test Equity submenu
    await bottomNav.getByRole("button", { name: "Equity menu" }).click();

    // Check that Equity submenu items are visible
    await expect(page.getByRole("link", { name: "Dividends" })).toBeVisible();

    // Navigate to Dividends
    await page.getByRole("link", { name: "Dividends" }).click();
    await expect(page.getByRole("heading", { name: "Dividends" })).toBeVisible();

    // Verify submenu closed after navigation
    await expect(page.getByRole("link", { name: "Dividends" })).not.toBeVisible();

    // Click on More button to open overflow menu
    await bottomNav.getByRole("button", { name: "More" }).click();

    // Check that overflow menu items are visible (People and Settings should be in overflow)
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Support center" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

    // Navigate to People from overflow menu
    await page.getByRole("link", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    // Verify overflow menu closed after navigation
    await expect(page.getByRole("link", { name: "Support center" })).not.toBeVisible();

    // Navigate to Documents directly
    await bottomNav.getByRole("link").filter({ hasText: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  });
});
