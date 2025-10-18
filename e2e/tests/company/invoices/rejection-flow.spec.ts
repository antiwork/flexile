import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { invoices } from "@/db/schema";

test.describe("invoice rejection flow", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let adminUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.create({ requiredInvoiceApprovalCount: 1 });
    adminUser = (await usersFactory.create()).user;
    contractorUser = (await usersFactory.create()).user;

    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });

    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
      payRateInSubunits: 6000,
      equityPercentage: 20,
    });
  });

  test("handles invoice rejection workflow including contractor editing", async ({ page }) => {
    // Contractor creates invoice
    await login(page, contractorUser, "/invoices/new");
    await page.getByPlaceholder("Description").fill("Development work");
    await page.getByLabel("Hours / Qty").fill("8:00");
    await page.getByLabel("Invoice ID").fill("INV-REJECT-001");
    await fillDatePicker(page, "Date", "12/15/2024");
    await page.getByPlaceholder("Enter notes about your invoice (optional)").fill("Q1 development work");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Verify invoice was created
    await expect(page.locator("tbody")).toContainText("INV-REJECT-001");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    // Logout and login as admin to reject the invoice
    await logout(page);
    await login(page, adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    // Reject the invoice with reason
    const invoiceRow = page.locator("tbody tr").filter({ hasText: contractorUser.legalName || "never" });
    await invoiceRow.getByLabel("Select row").check();
    await page.getByRole("button", { name: "Reject selected invoices" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByLabel("Explain why the invoice was").fill("Hours seem too high for the work described");
        await modal.getByRole("button", { name: "Yes, reject" }).click();
      },
      { page },
    );

    // Verify invoice shows as rejected
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Clear all filters" }).click();
    await expect(invoiceRow.getByText("Rejected")).toBeVisible();

    // Logout and login as contractor to see rejection
    await logout(page);
    await login(page, contractorUser);

    // Contractor should see rejected status
    const rejectedInvoiceRow = page.locator("tbody tr").filter({ hasText: "INV-REJECT-001" });
    await expect(rejectedInvoiceRow.getByText("Rejected")).toBeVisible();

    // Contractor should be able to edit the rejected invoice
    await rejectedInvoiceRow.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

    // Verify form fields are populated with original data
    await expect(page.getByLabel("Invoice ID")).toHaveValue("INV-REJECT-001");
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Development work");
    await expect(page.getByLabel("Hours / Qty").first()).toHaveValue("08:00");
    await expect(page.getByPlaceholder("Enter notes about your invoice (optional)")).toHaveValue("Q1 development work");

    // Make corrections and resubmit
    await page.getByPlaceholder("Description").first().fill("Corrected development work");
    await page.getByLabel("Hours / Qty").first().fill("6:00");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill("Corrected Q1 development work with accurate hours");
    await page.getByRole("button", { name: "Resubmit" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Verify invoice is back to awaiting approval
    await expect(page.locator("tbody")).toContainText("INV-REJECT-001");
    await expect(page.locator("tbody")).toContainText("$360"); // $60 * 6 hours
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await page.locator("tbody tr").filter({ hasText: "INV-REJECT-001" }).click();
    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();

    // Should not see rejection reason displayed
    await expect(page.getByText("Hours seem too high for the work described")).not.toBeVisible();

    // Logout and login as admin to see updated status
    await logout(page);
    await login(page, adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    // Should see corrected invoice back to awaiting approval
    const updatedInvoiceRow = page.locator("tbody tr").filter({ hasText: contractorUser.legalName || "never" });
    await expect(updatedInvoiceRow.getByText("Awaiting approval")).toBeVisible();

    // Verify database was updated correctly
    const updatedInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.companyId, company.company.id),
      orderBy: desc(invoices.id),
    });

    expect(updatedInvoice?.notes).toBe("Corrected Q1 development work with accurate hours");
    expect(updatedInvoice?.invoiceNumber).toBe("INV-REJECT-001");
  });
});
