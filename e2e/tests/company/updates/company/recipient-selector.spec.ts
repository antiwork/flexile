import { expect, test } from "@playwright/test";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { login } from "@test/helpers/auth";
import { eq } from "drizzle-orm";
import { companyUpdates } from "@/db/schema";

test.describe("recipient selector for company updates", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding();
    company = result.company;
    adminUser = result.adminUser;

    // Add test data
    await companyAdministratorsFactory.create({ companyId: company.id });
    await companyInvestorsFactory.create({ companyId: company.id });
    await companyInvestorsFactory.create({ companyId: company.id });
    await companyContractorsFactory.create({ companyId: company.id });
    await companyContractorsFactory.create({ companyId: company.id });
    await companyContractorsFactory.createInactive({ companyId: company.id });
  });

  test("admins are selected by default and cannot be removed", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");
    await page.getByRole("button", { name: "New update" }).click();

    const modal = page.getByRole("dialog", { name: "New company update" });

    // Admins should be visible by default
    await expect(modal.getByText("Admins")).toBeVisible();

    // Admins badge should NOT have X button - check there's no button inside the badge
    const adminsBadge = modal.locator("span", { hasText: "Admins" }).first();
    const xButton = adminsBadge.locator("button");
    await expect(xButton).toHaveCount(0);
  });

  test("can select and publish with multiple recipient types", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");
    await page.getByRole("button", { name: "New update" }).click();

    const modal = page.getByRole("dialog", { name: "New company update" });
    await expect(modal).toBeVisible();

    // Admins should be visible by default
    await expect(modal.getByText("Admins")).toBeVisible();

    // Click on the dropdown trigger (the button with Admins badge)
    const dropdownTrigger = modal.locator("button").filter({ hasText: "Admins" }).first();
    await dropdownTrigger.click();

    // Wait for menu to be visible
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Select investors
    await menu.getByText("Investors").click();

    // Investors badge should appear
    await expect(modal.getByText("Investors")).toBeVisible();

    // Fill form
    await modal.getByLabel("Title").fill("Test Update");
    const editor = modal.locator('[contenteditable="true"]');
    await editor.click();
    await editor.fill("Test content");

    // Publish
    await modal.getByRole("button", { name: "Publish" }).click();

    // Wait for publish confirmation dialog
    const publishDialog = page.getByRole("dialog", { name: "Publish update?" });
    await expect(publishDialog).toBeVisible();

    // Confirm publish
    await publishDialog.getByRole("button", { name: /Yes/u }).click();

    // Wait for dialogs to close
    await expect(publishDialog).not.toBeVisible();
    await expect(modal).not.toBeVisible();

    // Wait a bit for database write
    await page.waitForTimeout(1000);

    // Verify in database
    const updates = await db.query.companyUpdates.findMany({
      where: eq(companyUpdates.companyId, company.id),
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.recipientTypes).toContain("admins");
    expect(updates[0]?.recipientTypes).toContain("investors");
  });

  test("displays correct recipient counts", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");
    await page.getByRole("button", { name: "New update" }).click();

    const modal = page.getByRole("dialog", { name: "New company update" });

    // Should show count for admins (2)
    await expect(modal.getByText(/Recipients \(2\)/u)).toBeVisible();

    // Open dropdown
    const dropdownTrigger = modal.locator("button").filter({ hasText: "Admins" }).first();
    await dropdownTrigger.click();

    const menu = page.locator('[role="menu"]');

    // Check counts in menu items
    await expect(menu.getByText("Admins").locator("..").locator("..")).toContainText("2");
    await expect(menu.getByText("Investors").locator("..").locator("..")).toContainText("2");
    await expect(menu.getByText("Active contractors").locator("..").locator("..")).toContainText("2");
    await expect(menu.getByText("Alumni contractors").locator("..").locator("..")).toContainText("1");
  });
});
