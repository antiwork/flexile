import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillByLabel, fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Line item URL linkification", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.createCompletedOnboarding();
    contractorUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
      payRateInSubunits: 6000,
    });
  });

  test("linkifies multiple URL formats with proper attributes and preserves surrounding text", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Line 1: Multiple URLs (https, http) with surrounding text
    await page
      .getByPlaceholder("Description")
      .fill("Work on https://github.com/company/project/issues/123 and fixes for http://docs.internal.com/api");
    await fillByLabel(page, "Hours / Qty", "5:00", { index: 0 });

    // Line 2: www URL at start
    await page.getByRole("button", { name: "Add line item" }).click();
    await page.getByPlaceholder("Description").nth(1).fill("www.figma.com/file/abc123 review completed");
    await fillByLabel(page, "Hours / Qty", "2:00", { index: 1 });

    // Line 3: URL at end
    await page.getByRole("button", { name: "Add line item" }).click();
    await page.getByPlaceholder("Description").nth(2).fill("Implemented feature from https://linear.app/issue/456");
    await fillByLabel(page, "Hours / Qty", "3:00", { index: 2 });

    // Line 4: Complex URL with query params and fragment
    await page.getByRole("button", { name: "Add line item" }).click();
    await page
      .getByPlaceholder("Description")
      .nth(3)
      .fill("Reviewed https://app.example.com/page?id=123&tab=overview#section-3");
    await fillByLabel(page, "Hours / Qty", "1:30", { index: 3 });

    await fillByLabel(page, "Invoice ID", "INV-URL-TEST-001", { index: 0 });
    await fillDatePicker(page, "Date", "12/15/2024");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await page.getByRole("cell", { name: "INV-URL-TEST-001" }).click();
    await expect(page.getByRole("heading", { name: "Invoice INV-URL-TEST-001" })).toBeVisible();

    const servicesTable = page.locator("table").filter({ hasText: "Services" });

    // Line 1: Multiple https/http URLs with text
    const line1 = servicesTable.locator("tbody tr").nth(0);
    const githubLink = line1.getByRole("link", { name: "https://github.com/company/project/issues/123" });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute("href", "https://github.com/company/project/issues/123");
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");

    const docsLink = line1.getByRole("link", { name: "http://docs.internal.com/api" });
    await expect(docsLink).toHaveAttribute("href", "http://docs.internal.com/api");
    await expect(docsLink).toHaveAttribute("target", "_blank");
    await expect(line1).toContainText("Work on");
    await expect(line1).toContainText("and fixes for");

    // Line 2: www URL at start (should add https://)
    const line2 = servicesTable.locator("tbody tr").nth(1);
    const figmaLink = line2.getByRole("link", { name: "www.figma.com/file/abc123" });
    await expect(figmaLink).toHaveAttribute("href", "https://www.figma.com/file/abc123");
    await expect(figmaLink).toHaveAttribute("target", "_blank");
    await expect(line2).toContainText("review completed");

    // Line 3: URL at end
    const line3 = servicesTable.locator("tbody tr").nth(2);
    const linearLink = line3.getByRole("link", { name: "https://linear.app/issue/456" });
    await expect(linearLink).toHaveAttribute("href", "https://linear.app/issue/456");
    await expect(line3).toContainText("Implemented feature from");

    // Line 4: Complex URL with params and fragment
    const line4 = servicesTable.locator("tbody tr").nth(3);
    const complexLink = line4.getByRole("link", {
      name: "https://app.example.com/page?id=123&tab=overview#section-3",
    });
    await expect(complexLink).toHaveAttribute("href", "https://app.example.com/page?id=123&tab=overview#section-3");
    await expect(complexLink).toHaveAttribute("target", "_blank");
    await expect(complexLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("handles line items without URLs correctly", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Line 1: No URL
    await page.getByPlaceholder("Description").fill("Regular development work without any links");
    await fillByLabel(page, "Hours / Qty", "3:00", { index: 0 });

    // Line 2: Text that looks like URL but isn't (no protocol, no www)
    await page.getByRole("button", { name: "Add line item" }).click();
    await page.getByPlaceholder("Description").nth(1).fill("Updated example.com documentation in code comments");
    await fillByLabel(page, "Hours / Qty", "2:00", { index: 1 });

    await fillByLabel(page, "Invoice ID", "INV-NO-URL-001", { index: 0 });
    await fillDatePicker(page, "Date", "12/15/2024");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await page.getByRole("cell", { name: "INV-NO-URL-001" }).click();
    await expect(page.getByRole("heading", { name: "Invoice INV-NO-URL-001" })).toBeVisible();

    const servicesTable = page.locator("table").filter({ hasText: "Services" });

    // Line 1: No links at all
    const line1 = servicesTable.locator("tbody tr").nth(0);
    await expect(line1).toContainText("Regular development work without any links");
    await expect(line1.getByRole("link")).toHaveCount(0);

    // Line 2: Text preserved, no linkification
    const line2 = servicesTable.locator("tbody tr").nth(1);
    await expect(line2).toContainText("Updated example.com documentation in code comments");
    await expect(line2.getByRole("link")).toHaveCount(0);
  });
});
