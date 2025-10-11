import { expect, test } from "@playwright/test";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

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

          // Wait for action to complete before checking modal state
          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
      );
    });

    test("triggers primary action in invoice deletion modal", async ({ page, browserName }) => {
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

          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
      );
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

          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
      );
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
      await page.getByRole("link", { name: "Edit invoice" }).click();

      await page.getByLabel("Hours").fill("5:00");
      await page.getByRole("button", { name: "Save changes" }).click();

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

          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
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

          await page.keyboard.down("Control");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Control");

          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
      );
    });

    test("prevents default browser behavior", async ({ page, browserName }) => {
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

          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
      );

      await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    });
  });
});
