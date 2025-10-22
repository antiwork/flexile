import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillByLabel, fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Invoice URL linkification", () => {
  test("converts URLs in line item descriptions and notes to clickable links", async ({ page }) => {
    const company = await companiesFactory.createCompletedOnboarding();
    const contractorUser = (await usersFactory.createWithBusinessEntity()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });

    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("Work on https://github.com/antiwork/flexile project");
    await fillByLabel(page, "Hours / Qty", "01:00", { index: 0 });
    await fillDatePicker(page, "Date", "11/01/2024");
    await page.getByPlaceholder("Enter notes about your").fill("See https://docs.example.com for details");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoiceRow = page.getByRole("row").filter({ hasText: "Nov 1, 2024" });
    await invoiceRow.click();
    await expect(page.getByRole("heading", { name: /^Invoice/u })).toBeVisible();

    const lineItemLink = page.getByRole("link", { name: "https://github.com/antiwork/flexile" });
    await expect(lineItemLink).toBeVisible();
    await expect(lineItemLink).toHaveAttribute("href", "https://github.com/antiwork/flexile");
    await expect(lineItemLink).toHaveAttribute("target", "_blank");
    await expect(lineItemLink).toHaveAttribute("rel", "noopener noreferrer");

    const notesLink = page.getByRole("link", { name: "https://docs.example.com" });
    await expect(notesLink).toBeVisible();
    await expect(notesLink).toHaveAttribute("href", "https://docs.example.com");
    await expect(notesLink).toHaveAttribute("target", "_blank");
    await expect(notesLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("handles multiple URLs in the same text", async ({ page }) => {
    const company = await companiesFactory.createCompletedOnboarding();
    const contractorUser = (await usersFactory.createWithBusinessEntity()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });

    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("Updated https://github.com/repo1 and https://github.com/repo2");
    await fillByLabel(page, "Hours / Qty", "02:00", { index: 0 });
    await fillDatePicker(page, "Date", "11/15/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoiceRow = page.getByRole("row").filter({ hasText: "Nov 15, 2024" });
    await invoiceRow.click();
    await expect(page.getByRole("heading", { name: /^Invoice/u })).toBeVisible();

    await expect(page.getByRole("link", { name: "https://github.com/repo1" })).toBeVisible();
    await expect(page.getByRole("link", { name: "https://github.com/repo2" })).toBeVisible();
  });

  test("does not linkify text without protocol", async ({ page }) => {
    const company = await companiesFactory.createCompletedOnboarding();
    const contractorUser = (await usersFactory.createWithBusinessEntity()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });

    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("Work on github.com project");
    await fillByLabel(page, "Hours / Qty", "01:30", { index: 0 });
    await fillDatePicker(page, "Date", "11/20/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoiceRow = page.getByRole("row").filter({ hasText: "Nov 20, 2024" });
    await invoiceRow.click();
    await expect(page.getByRole("heading", { name: /^Invoice/u })).toBeVisible();

    // Should display text but not as a link
    await expect(page.getByText("Work on github.com project")).toBeVisible();
    await expect(page.getByRole("link", { name: "github.com" })).not.toBeVisible();
  });

  test("correctly handles URLs with surrounding whitespace and text", async ({ page }) => {
    const company = await companiesFactory.createCompletedOnboarding();
    const contractorUser = (await usersFactory.createWithBusinessEntity()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });

    await login(page, contractorUser, "/invoices/new");

    // URL with text before and after, separated by spaces
    await page.getByPlaceholder("Description").fill("Fixed bug in https://github.com/project today");
    await fillByLabel(page, "Hours / Qty", "02:30", { index: 0 });
    await fillDatePicker(page, "Date", "11/25/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoiceRow = page.getByRole("row").filter({ hasText: "Nov 25, 2024" });
    await invoiceRow.click();
    await expect(page.getByRole("heading", { name: /^Invoice/u })).toBeVisible();

    // URL should be linked, but surrounding text should remain plain
    await expect(page.getByText("Fixed bug in")).toBeVisible();
    await expect(page.getByRole("link", { name: "https://github.com/project" })).toBeVisible();
    await expect(page.getByText("today")).toBeVisible();
  });
});
