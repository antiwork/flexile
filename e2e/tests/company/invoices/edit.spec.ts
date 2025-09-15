import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { invoices } from "@/db/schema";

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

    // Fill in the invoice form
    await page.getByPlaceholder("Description").fill("Development work for Q1");
    await page.getByLabel("Hours / Qty").fill("10:00");
    await page.getByLabel("Rate").fill("75");
    await page.getByLabel("Invoice ID").fill("INV-EDIT-001");
    await fillDatePicker(page, "Date", "12/15/2024");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill(
        "This invoice covers the Q1 development sprint including new features and bug fixes. Please process within 30 days.",
      );

    // Submit the invoice
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Verify the invoice was created
    await expect(page.locator("tbody")).toContainText("INV-EDIT-001");
    await expect(page.locator("tbody")).toContainText("$750"); // $75 * 10 hours

    // Get the created invoice from the database
    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    // Verify the notes were saved
    expect(invoice.notes).toBe(
      "This invoice covers the Q1 development sprint including new features and bug fixes. Please process within 30 days.",
    );

    // Now edit the invoice
    await page.getByRole("cell", { name: "INV-EDIT-001" }).click();
    await page.getByRole("link", { name: "Edit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

    // Verify all form fields are populated correctly
    await expect(page.getByLabel("Invoice ID")).toHaveValue("INV-EDIT-001");
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Development work for Q1");
    await expect(page.getByLabel("Hours / Qty").first()).toHaveValue("10:00");
    await expect(page.getByLabel("Rate").first()).toHaveValue("75");
    await expect(page.getByPlaceholder("Enter notes about your invoice (optional)")).toHaveValue(
      "This invoice covers the Q1 development sprint including new features and bug fixes. Please process within 30 days.",
    );

    // Make some changes
    await page.getByPlaceholder("Description").first().fill("Updated development work for Q1");
    await page.getByLabel("Hours / Qty").first().fill("12:00");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill(
        "Updated notes: This invoice covers the Q1 development sprint including new features, bug fixes, and additional enhancements. Please process within 30 days.",
      );

    // Submit the updated invoice
    await page.getByRole("button", { name: "Resubmit" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Verify the invoice was updated
    await expect(page.locator("tbody")).toContainText("$900"); // $75 * 12 hours

    // Verify the database was updated
    const updatedInvoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) }).then(takeOrThrow);

    expect(updatedInvoice.notes).toBe(
      "Updated notes: This invoice covers the Q1 development sprint including new features, bug fixes, and additional enhancements. Please process within 30 days.",
    );
    expect(updatedInvoice.invoiceNumber).toBe("INV-EDIT-001");
  });
});
