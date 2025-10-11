import { expect, test } from "@playwright/test";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { withinModal } from "@test/index";

test.describe("Modal Keyboard Shortcuts", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let adminUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.create({ requiredInvoiceApprovalCount: 1, isTrusted: true });
    adminUser = (await usersFactory.create()).user;
    contractorUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });
  });

  test.describe("Cmd+Enter / Ctrl+Enter shortcuts", () => {
    test("triggers primary action in invoice deletion modal", async ({ page, browserName }) => {
      // Create invoice as contractor
      await login(page, contractorUser);
      await page.locator("header").getByRole("link", { name: "New invoice" }).click();
      await page.getByLabel("Invoice ID").fill("TEST-DELETE");
      await page.getByPlaceholder("Description").fill("Invoice to delete");
      await page.getByRole("button", { name: "Send invoice" }).click();

      // Right-click to delete as contractor
      await page.getByRole("cell", { name: "TEST-DELETE" }).click({ button: "right" });
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

    test("works with AlertDialog components", async ({ page, browserName }) => {
      // Create invoice as contractor
      await login(page, contractorUser);
      await page.locator("header").getByRole("link", { name: "New invoice" }).click();
      await page.getByLabel("Invoice ID").fill("TEST-EDIT");
      await page.getByPlaceholder("Description").fill("Invoice to edit");
      await page.getByRole("button", { name: "Send invoice" }).click();

      // Click to edit
      await page.getByRole("cell", { name: "TEST-EDIT" }).click();
      await page.getByRole("link", { name: "Edit invoice" }).click();

      await page.getByPlaceholder("Description").first().fill("Updated description");
      await page.getByRole("button", { name: "Resubmit" }).click();

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

          await page.waitForTimeout(1000);
        },
        { page, assertClosed: true },
      );
    });
  });
});
