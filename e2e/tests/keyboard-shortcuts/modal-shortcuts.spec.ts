import { expect, test } from "@playwright/test";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { invoices, users } from "@/db/schema";

test.describe("Modal Keyboard Shortcuts", () => {
  const setupCompany = async () => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
    const user = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) });
    if (!user) throw new Error("User not found");
    return { company, user };
  };

  test.describe("Cmd+Enter / Ctrl+Enter shortcuts", () => {
    test("triggers primary action in invoice rejection modal", async ({ page, browserName }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.getByRole("checkbox", { name: "Select all" }).check();
      await page.getByRole("button", { name: "Reject selected" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Yes, reject")).toBeVisible();

          // Platform-aware shortcut with explicit modifiers
          const isMac = browserName === "webkit" || process.platform === "darwin";
          if (isMac) {
            await page.keyboard.down("Meta");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Meta");
          } else {
            await page.keyboard.down("Control");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Control");
          }
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );

      // Verify invoices were rejected
      const updatedInvoices = await db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });
      expect(updatedInvoices.every((invoice) => invoice.status === "rejected")).toBe(true);
    });

    test("triggers primary action in invoice deletion modal", async ({ page, browserName }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await invoiceRow.click({ button: "right" });
      const deleteItem = page.getByRole("menuitem", { name: "Delete" });
      await expect(deleteItem).toBeVisible();
      await deleteItem.click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Delete")).toBeVisible();
          const isMac = browserName === "webkit" || process.platform === "darwin";
          if (isMac) {
            await page.keyboard.down("Meta");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Meta");
          } else {
            await page.keyboard.down("Control");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Control");
          }
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );

      // Verify invoice was deleted
      const remainingInvoices = await db.query.invoices.findMany({
        where: eq(invoices.companyId, company.id),
      });
      expect(remainingInvoices.length).toBe(0);
    });

    test("triggers primary action in invoice approval modal", async ({ page, browserName }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.getByRole("checkbox", { name: "Select all" }).check();
      await page.getByRole("button", { name: "Approve selected" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Yes, proceed")).toBeVisible();

          const isMac = browserName === "webkit" || process.platform === "darwin";
          if (isMac) {
            await page.keyboard.down("Meta");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Meta");
          } else {
            await page.keyboard.down("Control");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Control");
          }
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );

      // Verify invoices were approved
      const updatedInvoices = await db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });
      expect(updatedInvoices.every((invoice) => invoice.status === "approved")).toBe(true);
    });

    test("does not trigger when focused on input fields", async ({ page }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.getByRole("checkbox", { name: "Select all" }).check();
      await page.getByRole("button", { name: "Reject selected" }).click();

      await withinModal(
        async (modal) => {
          const reasonInput = modal.getByLabel("Explain why the invoice");
          await reasonInput.click();
          await reasonInput.fill("Test reason");

          // Keyboard shortcut should not trigger when focused on input
          await page.keyboard.press("Meta+Enter");
          await expect(modal).toBeVisible();
          await expect(reasonInput).toHaveValue("Test reason");
        },
        { page, assertClosed: false },
      );
    });

    test("works with AlertDialog components", async ({ page, browserName }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("row").getByText("Awaiting approval").first().click();
      await page.getByRole("button", { name: "Edit" }).click();

      // Fill some data to trigger the alert
      await page.getByLabel("Hours").fill("5:00");
      await page.getByRole("button", { name: "Save changes" }).click();

      // Navigate away to trigger unsaved changes alert
      await page.getByRole("link", { name: "Invoices" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Discard changes")).toBeVisible();

          const isMac = browserName === "webkit" || process.platform === "darwin";
          if (isMac) {
            await page.keyboard.down("Meta");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Meta");
          } else {
            await page.keyboard.down("Control");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Control");
          }
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );
    });

    test("works with Ctrl+Enter on Windows/Linux", async ({ page }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await invoiceRow.click({ button: "right" });
      {
        const deleteItem2 = page.getByRole("menuitem", { name: "Delete" });
        await expect(deleteItem2).toBeVisible();
        await deleteItem2.click();
      }

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Delete")).toBeVisible();

          await page.keyboard.down("Control");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Control");
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );
    });

    test("prevents default browser behavior", async ({ page, browserName }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await invoiceRow.click({ button: "right" });
      {
        const deleteItem3 = page.getByRole("menuitem", { name: "Delete" });
        await expect(deleteItem3).toBeVisible();
        await deleteItem3.click();
      }

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Delete")).toBeVisible();

          const isMac = browserName === "webkit" || process.platform === "darwin";
          if (isMac) {
            await page.keyboard.down("Meta");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Meta");
          } else {
            await page.keyboard.down("Control");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Control");
          }
          await expect(modal).not.toBeVisible();

          // Verify no unexpected page navigation or form submission occurred
          await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
        },
        { page, assertClosed: false },
      );
    });
  });
});
