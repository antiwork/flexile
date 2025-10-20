import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillByLabel, fillDatePicker } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, type Page, test, withinModal } from "@test/index";

type User = Awaited<ReturnType<typeof usersFactory.create>>["user"];

test.describe("Invoice submission, approval and rejection", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let adminUser: User;
  let workerUserA: User;
  let workerUserB: User;

  test.beforeEach(async (_notUsed, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 10_000);
    company = await companiesFactory.create({ requiredInvoiceApprovalCount: 1, isTrusted: true });
    adminUser = (await usersFactory.create()).user;
    workerUserA = (await usersFactory.create()).user;
    workerUserB = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: workerUserA.id,
    });
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: workerUserB.id,
    });
  });

  test("allows contractor to submit/delete invoices and admin to approve/reject them", async ({ page }) => {
    await login(page, workerUserA);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-1");
    await fillDatePicker(page, "Date", "11/01/2024");
    await page.getByPlaceholder("Description").fill("first item");
    await fillByLabel(page, "Hours / Qty", "01:23", { index: 0 });
    await page.getByRole("button", { name: "Add line item" }).click();
    await page.getByPlaceholder("Description").nth(1).fill("second item");
    await fillByLabel(page, "Hours / Qty", "10", { index: 1 });
    await page.getByPlaceholder("Enter notes about your").fill("A note in the invoice");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("woops too little time");
    await fillByLabel(page, "Hours / Qty", "0:23", { index: 0 });
    await page.getByLabel("Invoice ID").fill("CUSTOM-2");
    await fillDatePicker(page, "Date", "12/01/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await page
      .getByTableRowCustom({
        "Invoice ID": "CUSTOM-1",
        "Sent on": "Nov 1, 2024",
        Amount: "$683",
        Status: "Awaiting approval",
      })
      .click();
    await page.getByRole("link", { name: "Edit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();
    await page.getByPlaceholder("Description").first().fill("first item updated");
    await fillByLabel(page, "Hours / Qty", "04:30", { index: 0 });
    await page.getByRole("button", { name: "Resubmit" }).click();

    await expect(
      page.getByTableRowCustom({
        "Invoice ID": "CUSTOM-1",
        "Sent on": "Nov 1, 2024",
        Amount: "$870",
        Status: "Awaiting approval",
      }),
    ).toBeVisible();
    await expect(locateOpenInvoicesBadge(page)).not.toBeVisible();

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Invoice to be deleted");
    await fillByLabel(page, "Hours / Qty", "0:33", { index: 0 });
    await page.getByLabel("Invoice ID").fill("CUSTOM-3");
    await fillDatePicker(page, "Date", "12/01/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();

    const deleteInvoiceRow = page.getByTableRowCustom({
      "Invoice ID": "CUSTOM-3",
      "Sent on": "Dec 1, 2024",
      Amount: "$33",
      Status: "Awaiting approval",
    });

    await deleteInvoiceRow.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Delete" }).click();
      },
      { page },
    );
    await expect(deleteInvoiceRow).not.toBeVisible();

    await logout(page);
    await login(page, workerUserB);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("line item");
    await fillByLabel(page, "Hours / Qty", "10:23", { index: 0 });
    await fillDatePicker(page, "Date", "11/20/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByText("Awaiting approval")).toBeVisible();

    await logout(page);
    await login(page, adminUser);

    const firstRow = page.getByTableRowCustom({ "Sent on": "Dec 1, 2024", Amount: "$23", Status: "Awaiting approval" });
    const secondRow = page.getByTableRowCustom({
      "Sent on": "Nov 20, 2024",
      Amount: "$623",
      Status: "Awaiting approval",
    });
    const thirdRow = page.getByTableRowCustom({ "Sent on": "Nov 1, 2024", Amount: "$870" });
    const openInvoicesBadge = locateOpenInvoicesBadge(page);

    await expect(openInvoicesBadge).toContainText("3");
    await expect(firstRow.getByRole("button", { name: "Pay now" })).toBeVisible();
    await expect(secondRow.getByRole("button", { name: "Pay now" })).toBeVisible();

    await expect(thirdRow).toContainText("Nov 1, 2024");
    await expect(thirdRow).toContainText("$870");
    await expect(thirdRow).toContainText("Awaiting approval");
    await thirdRow.getByRole("button", { name: "Pay now" }).click();

    await expect(thirdRow).not.toBeVisible();
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Clear all filters" }).click();
    await expect(thirdRow).toContainText("Payment scheduled");
    await expect(openInvoicesBadge).toContainText("2");

    await firstRow.getByLabel("Select row").check();

    await expect(page.getByText("1 selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject selected invoices" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve selected invoices" })).toBeVisible();

    await secondRow.getByLabel("Select row").check();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByRole("button", { name: "Approve selected invoices" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByText("You are paying $646 now.")).toBeVisible();
        await expect(modal.getByText(workerUserA.legalName ?? "never")).toBeVisible();
        await expect(modal.getByText("$623")).toBeVisible();
        await expect(modal.getByText(workerUserB.legalName ?? "never")).toBeVisible();
        await expect(modal.getByText("$23")).toBeVisible();
        await expect(modal.getByRole("button", { name: "No, cancel" })).toBeVisible();
        await expect(modal.getByRole("button", { name: "Yes, proceed" })).toBeVisible();
        await modal.getByRole("button", { name: "No, cancel" }).click();
      },
      { page, title: "Approve these invoices?" },
    );

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await page.getByRole("checkbox", { name: "Select all" }).uncheck();
    await firstRow.getByLabel("Select row").check();
    await page.getByRole("button", { name: "Reject selected invoices" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByLabel("Explain why the invoice was").fill("Too little time");
        await modal.getByRole("button", { name: "Yes, reject" }).click();
      },
      { page },
    );
    await expect(page.getByTableRowCustom({ Amount: "$23" })).toContainText("Rejected");
    await expect(openInvoicesBadge).toContainText("1");

    await page.getByRole("cell", { name: workerUserB.legalName ?? "never" }).click();
    await page.getByRole("link", { name: "View invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();
    await page.locator("header").filter({ hasText: "Invoice" }).getByRole("button", { name: "Pay now" }).click();

    await expect(openInvoicesBadge).not.toBeVisible();

    await logout(page);
    await login(page, workerUserA);

    const approvedInvoiceRow = page.getByTableRowCustom({ "Invoice ID": "CUSTOM-1" });
    const rejectedInvoiceRow = page.getByTableRowCustom({ "Invoice ID": "CUSTOM-2" });

    await expect(approvedInvoiceRow.getByRole("cell", { name: "Payment scheduled" })).toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).toBeVisible();

    await rejectedInvoiceRow.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();
    await fillByLabel(page, "Hours / Qty", "02:30", { index: 0 });
    await page.getByPlaceholder("Enter notes about your").fill("fixed hours");
    await page.getByRole("button", { name: "Resubmit" }).click();

    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).not.toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Awaiting approval" })).toBeVisible();

    await logout(page);
    await login(page, adminUser);

    await expect(locateOpenInvoicesBadge(page)).toContainText("1");
    await page.getByTableRowCustom({ Amount: "$150" }).click();

    await page.getByRole("button", { name: "Reject" }).click();
    await page.getByLabel("Explain why the invoice was").fill("sorry still wrong");
    await page.getByRole("button", { name: "Yes, reject" }).click();

    await expect(locateOpenInvoicesBadge(page)).not.toBeVisible();
  });

  const locateOpenInvoicesBadge = (page: Page) => page.getByRole("link", { name: "Invoices" }).getByRole("status");
});
