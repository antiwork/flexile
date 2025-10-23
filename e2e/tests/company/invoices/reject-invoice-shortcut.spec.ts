import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { invoices as invoicesTable, users } from "@/db/schema";
import { assert } from "@/utils/assert";

const setupAdminAndInvoice = async () => {
  const { company } = await companiesFactory.create({ isTrusted: true, requiredInvoiceApprovalCount: 1 });
  const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
  const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) });
  assert(adminUser !== undefined);

  const invoiceNumber = `INV-SHORTCUT-${Date.now()}`;
  const { invoice } = await invoicesFactory.create({ companyId: company.id, invoiceNumber });
  return { adminUser, company, invoice };
};

test.describe("Reject invoice: primary action shortcut", () => {
  test("ControlOrMeta+Enter submits the dialog", async ({ page }) => {
    const { adminUser, invoice } = await setupAdminAndInvoice();

    await login(page, adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await expect(page.getByText("1 selected")).toBeVisible();

    await page.getByRole("button", { name: "Reject" }).click();

    await withinModal(
      async (modal) => {
        await modal.getByRole("textbox").focus();
        await modal.getByRole("textbox").press("Control+Enter");
        await page.keyboard.press("Meta+Enter");
      },
      { page },
    );

    await expect
      .poll(async () => (await db.query.invoices.findFirst({ where: eq(invoicesTable.id, invoice.id) }))?.status)
      .toBe("rejected");

    await page.reload();
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Clear all filters" }).click();

    await expect(page.getByRole("cell", { name: "Rejected" })).toBeVisible();
  });

  test("Enter alone inside textarea does not submit", async ({ page }) => {
    const { adminUser, invoice } = await setupAdminAndInvoice();

    await login(page, adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await page.getByRole("button", { name: "Reject" }).click();

    await withinModal(
      async (modal) => {
        await modal.getByRole("textbox").focus();
        await modal.getByRole("textbox").press("Enter");

        await page.waitForTimeout(200);

        await expect(modal.getByRole("button", { name: "Yes, reject" })).toBeVisible();
      },
      { page, assertClosed: false },
    );

    const fresh = await db.query.invoices.findFirst({ where: eq(invoicesTable.id, invoice.id) });
    expect(fresh?.status).not.toBe("rejected");
  });
});
