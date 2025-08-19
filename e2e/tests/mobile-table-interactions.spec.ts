import { companiesFactory } from "@test/factories/companies";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Mobile table interactions", () => {
  const mobileViewport = { width: 640, height: 800 };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(mobileViewport);
  });

  test("mobile select all and dropdown menu functionality works", async ({ page }) => {
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding({
      requiredInvoiceApprovalCount: 1,
    });

    for (let i = 0; i < 3; i++) {
      await invoicesFactory.create({ companyId: company.id });
    }

    await login(page, adminUser);
    await page.goto("/invoices");
    await expect(page.getByRole("button", { name: "Select all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More options" })).toBeVisible();

    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByLabel("Select row").first()).toBeChecked();
    await expect(page.getByText("3 selected")).toBeVisible();

    await page.getByRole("button", { name: "Unselect all" }).click();
    await expect(page.getByLabel("Select row").first()).not.toBeChecked();

    await page.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Download CSV" })).toBeVisible();

    await page.getByRole("menuitem", { name: "Download CSV" }).click();
    await expect(page.getByRole("menuitem", { name: "Download CSV" })).not.toBeVisible();
  });
});
