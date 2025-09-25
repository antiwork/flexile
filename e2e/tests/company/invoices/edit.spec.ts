import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { companyContractors, invoiceLineItems, invoices } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("invoice editing", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });
    contractorUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
      payRateInSubunits: 6000,
      equityPercentage: 20,
    });
  });

  test("preserves form fields when editing an invoice", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Wait for the form to load
    await expect(page.getByLabel("Invoice ID")).toBeVisible();

    // Fill in the invoice form - clear Invoice ID field first to ensure clean input
    await page.getByPlaceholder("Description").fill("Development work for Q1");
    await page.getByLabel("Hours / Qty").fill("10:00");
    await page.getByLabel("Rate").fill("75");
    await page.getByLabel("Invoice ID").clear();
    await page.getByLabel("Invoice ID").fill("INV-EDIT-001");
    await fillDatePicker(page, "Date", "12/15/2024");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill(
        "This invoice covers the Q1 development sprint including new features and bug fixes. Please process within 30 days.",
      );

    // Verify the Invoice ID was entered correctly before submitting
    await expect(page.getByLabel("Invoice ID")).toHaveValue("INV-EDIT-001");

    // Submit the invoice
    await page.getByRole("button", { name: "Send invoice" }).click();

    // Wait for navigation and the invoice to appear in the table
    await page.waitForURL("**/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "INV-EDIT-001" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("$750"); // $75 * 10 hours

    // Get the created invoice from the database
    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    // Verify the invoice number was saved correctly
    expect(invoice.invoiceNumber).toBe("INV-EDIT-001");

    // Verify the notes were saved
    expect(invoice.notes).toBe(
      "This invoice covers the Q1 development sprint including new features and bug fixes. Please process within 30 days.",
    );

    // Now edit the invoice
    await page.getByRole("cell", { name: "INV-EDIT-001" }).click();
    await page.getByRole("link", { name: "Edit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

    // Wait for form fields to be populated with existing data
    await expect(page.getByLabel("Invoice ID")).toHaveValue("INV-EDIT-001");
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Development work for Q1");
    await expect(page.getByLabel("Hours / Qty").first()).toHaveValue("10:00");
    await expect(page.getByLabel("Rate").first()).toHaveValue("75");
    await expect(page.getByPlaceholder("Enter notes about your invoice (optional)")).toHaveValue(
      "This invoice covers the Q1 development sprint including new features and bug fixes. Please process within 30 days.",
    );

    // Make some changes
    await page.getByPlaceholder("Description").first().clear();
    await page.getByPlaceholder("Description").first().fill("Updated development work for Q1");

    await page.getByLabel("Hours / Qty").first().clear();
    await page.getByLabel("Hours / Qty").first().fill("12:00");

    await page.getByPlaceholder("Enter notes about your invoice (optional)").clear();
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill(
        "Updated notes: This invoice covers the Q1 development sprint including new features, bug fixes, and additional enhancements. Please process within 30 days.",
      );

    // Verify the changes were entered correctly before submitting
    await expect(page.getByLabel("Hours / Qty").first()).toHaveValue("12:00");
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Updated development work for Q1");

    // Submit the updated invoice
    await page.getByRole("button", { name: "Resubmit" }).click();

    // Wait for navigation and verify the updated amount appears
    await page.waitForURL("**/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Wait for the specific invoice row to update with new amount
    await expect(page.getByRole("row").filter({ hasText: "INV-EDIT-001" })).toContainText("$900");

    // Verify the database was updated
    const updatedInvoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) }).then(takeOrThrow);

    expect(updatedInvoice.notes).toBe(
      "Updated notes: This invoice covers the Q1 development sprint including new features, bug fixes, and additional enhancements. Please process within 30 days.",
    );
    expect(updatedInvoice.invoiceNumber).toBe("INV-EDIT-001");
  });

  test("displays fresh data after editing and returning to the edit page", async ({ page }) => {
    // Create an invoice with initial data
    const existingContractor = await db.query.companyContractors.findFirst({
      where: eq(companyContractors.companyId, company.company.id),
    });
    assert(existingContractor !== undefined);

    const invoiceData = await invoicesFactory.create({
      companyContractorId: existingContractor.id,
      invoiceNumber: "INV-STALE-TEST",
      notes: "Original notes.",
    });

    const existingLineItem = await db.query.invoiceLineItems.findFirst({
      where: eq(invoiceLineItems.invoiceId, invoiceData.invoice.id),
    });
    assert(existingLineItem !== undefined);

    await db
      .update(invoiceLineItems)
      .set({
        description: "Development work",
        quantity: "1",
        payRateInSubunits: 6000,
      })
      .where(eq(invoiceLineItems.id, existingLineItem.id));

    await login(page, contractorUser);

    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "INV-STALE-TEST" })).toBeVisible();

    // Navigate to edit page
    await page.getByRole("cell", { name: "INV-STALE-TEST" }).click();
    await page.getByRole("link", { name: "Edit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

    // Wait for initial data to be loaded in form fields
    await expect(page.getByPlaceholder("Enter notes about your invoice (optional)")).toHaveValue("Original notes.");
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Development work");

    // Update the invoice data
    await page.getByPlaceholder("Enter notes about your invoice (optional)").fill("Updated notes after first edit.");
    await page.getByPlaceholder("Description").first().fill("Updated development work");
    await page.getByRole("button", { name: "Resubmit" }).click();

    // Wait for navigation back to invoices list
    await page.waitForURL("**/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Navigate back to edit page
    await page.getByRole("cell", { name: "INV-STALE-TEST" }).click();
    await page.getByRole("link", { name: "Edit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

    // Verify fresh data is displayed (not stale cached data)
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Updated development work");
    await expect(page.getByPlaceholder("Enter notes about your invoice (optional)")).toHaveValue(
      "Updated notes after first edit.",
    );

    // Confirm database has the correct data
    const updatedInvoice = await db.query.invoices
      .findFirst({ where: eq(invoices.id, invoiceData.invoice.id) })
      .then(takeOrThrow);
    expect(updatedInvoice.notes).toBe("Updated notes after first edit.");

    // Verify line items were updated in database
    const updatedLineItems = await db.query.invoiceLineItems.findMany({
      where: eq(invoiceLineItems.invoiceId, invoiceData.invoice.id),
    });
    expect(updatedLineItems).toHaveLength(1);
    const lineItem = updatedLineItems[0];
    expect(lineItem?.description).toBe("Updated development work");
  });
});
