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
    test("triggers primary action in invoice rejection modal", async ({ page }) => {
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

          // Test keyboard shortcut triggers the primary action
          await page.keyboard.press("Meta+Enter");
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );

      // Verify invoices were rejected
      const updatedInvoices = await db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });
      expect(updatedInvoices.every((invoice) => invoice.status === "rejected")).toBe(true);
    });

    test("triggers primary action in invoice deletion modal", async ({ page }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await invoiceRow.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Delete")).toBeVisible();

          // Test keyboard shortcut triggers the primary action
          await page.keyboard.press("Meta+Enter");
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

    test("triggers primary action in invoice approval modal", async ({ page }) => {
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

          // Test keyboard shortcut triggers the primary action
          await page.keyboard.press("Meta+Enter");
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

    test("works with AlertDialog components", async ({ page }) => {
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

          // Test keyboard shortcut triggers the primary action
          await page.keyboard.press("Meta+Enter");
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
      await page.getByRole("menuitem", { name: "Delete" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Delete")).toBeVisible();

          // Test Ctrl+Enter shortcut (Windows/Linux)
          await page.keyboard.press("Control+Enter");
          await expect(modal).not.toBeVisible();
        },
        { page, assertClosed: false },
      );
    });

    test("prevents default browser behavior", async ({ page }) => {
      const { company, user } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await invoiceRow.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Delete")).toBeVisible();

          // Test that the shortcut prevents default behavior
          await page.keyboard.press("Meta+Enter");
          await expect(modal).not.toBeVisible();

          // Verify no unexpected page navigation or form submission occurred
          await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
        },
        { page, assertClosed: false },
      );
    });
  });
});
