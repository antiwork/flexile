import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, type Page, test, withinModal } from "@test/index";

type User = Awaited<ReturnType<typeof usersFactory.create>>["user"];

test.describe("Invoice submission, approval and rejection", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let adminUser: User;
  let workerUserA: User;
  let workerUserB: User;

  test.beforeEach(async () => {
    company = await companiesFactory.create({ requiredInvoiceApprovalCount: 1 });
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
    await page.waitForTimeout(500); // TODO (dani) avoid this
    await page.getByLabel("Hours / Qty").first().fill("01:23");
    await page.waitForTimeout(500); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Add line item" }).click();
    await page.getByPlaceholder("Description").nth(1).fill("second item");
    await page.getByLabel("Hours / Qty").nth(1).fill("10");
    await page.getByPlaceholder("Enter notes about your").fill("A note in the invoice");
    await page.waitForTimeout(200); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-1" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Nov 1, 2024");
    await expect(page.locator("tbody")).toContainText("$683");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("woops too little time");
    await page.getByLabel("Hours / Qty").fill("0:23");
    await page.getByLabel("Invoice ID").fill("CUSTOM-2");
    await page.waitForTimeout(300); // TODO (dani) avoid this
    await fillDatePicker(page, "Date", "12/01/2024");
    await page.waitForTimeout(300); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-2" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Dec 1, 2024");
    await expect(page.locator("tbody")).toContainText("$23");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await page.getByRole("cell", { name: "CUSTOM-1" }).click();
    await page.getByRole("link", { name: "Edit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();
    await page.getByPlaceholder("Description").first().fill("first item updated");
    const timeField = page.getByLabel("Hours / Qty").first();
    await timeField.fill("04:30");
    await timeField.blur(); // work around a test-specific issue; this works fine in a real browser
    await page.waitForTimeout(1000); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Re-submit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "$870" })).toBeVisible();
    await expect(locateOpenInvoicesBadge(page)).not.toBeVisible();

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Invoice to be deleted");
    await page.getByLabel("Hours / Qty").fill("0:33");
    await page.getByLabel("Invoice ID").fill("CUSTOM-3");
    await page.waitForTimeout(300); // TODO (dani) avoid this
    await fillDatePicker(page, "Date", "12/01/2024");
    await page.waitForTimeout(300); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-3" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Dec 1, 2024");
    await expect(page.locator("tbody")).toContainText("$33");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await page.getByRole("cell", { name: "CUSTOM-3" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("cell", { name: "CUSTOM-3" })).not.toBeVisible();

    await logout(page);
    await login(page, workerUserB);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("line item");
    await page.getByLabel("Hours / Qty").fill("10:23");
    await fillDatePicker(page, "Date", "11/20/2024");
    await page.waitForTimeout(200); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByText("Awaiting approval")).toBeVisible();

    await logout(page);
    await login(page, adminUser);

    const firstRow = page.locator("tbody tr").first();
    const secondRow = page.locator("tbody tr").nth(1);
    const thirdRow = page.locator("tbody tr").nth(2);
    const openInvoicesBadge = locateOpenInvoicesBadge(page);

    await expect(openInvoicesBadge).toContainText("3");
    await expect(firstRow).toContainText("Dec 1, 2024");
    await expect(firstRow).toContainText("$23");
    await expect(firstRow).toContainText("Awaiting approval");
    await expect(firstRow.getByRole("button", { name: "Pay now" })).toBeVisible();
    await expect(secondRow).toContainText("Nov 20, 2024");
    await expect(secondRow).toContainText("$623");
    await expect(secondRow).toContainText("Awaiting approval");
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

    await page.locator("tbody tr").first().getByLabel("Select row").check();

    await expect(page.getByText("1 selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject selected invoices" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve selected invoices" })).toBeVisible();

    await page.locator("tbody tr").nth(1).getByLabel("Select row").check();
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
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await page.getByRole("checkbox", { name: "Select all" }).uncheck();
    await page
      .locator("tbody tr")
      .filter({ hasText: workerUserA.legalName ?? "never" })
      .filter({ hasText: "$23" })
      .getByLabel("Select row")
      .check();
    await page.getByRole("button", { name: "Reject selected invoices" }).click();
    await page.getByLabel("Explain why the invoice was").fill("Too little time");

    await page.getByRole("button", { name: "Yes, reject" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const rejectedInvoiceRow0 = page
      .locator("tbody tr")
      .filter({ hasText: workerUserA.legalName ?? "never" })
      .filter({ hasText: "$23" });
    await expect(rejectedInvoiceRow0).toContainText("Rejected");
    await expect(openInvoicesBadge).toContainText("1");

    await page.getByRole("cell", { name: workerUserB.legalName ?? "never" }).click();
    await page.getByRole("link", { name: "View invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();
    await page.locator("header").filter({ hasText: "Invoice" }).getByRole("button", { name: "Pay now" }).click();

    await expect(openInvoicesBadge).not.toBeVisible();

    await logout(page);
    await login(page, workerUserA);

    const approvedInvoiceRow = page.locator("tbody tr").filter({ hasText: "CUSTOM-1" });
    const rejectedInvoiceRow = page.locator("tbody tr").filter({ hasText: "CUSTOM-2" });

    await expect(approvedInvoiceRow.getByRole("cell", { name: "Payment scheduled" })).toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).toBeVisible();

    await rejectedInvoiceRow.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();
    await page.getByLabel("Hours / Qty").fill("02:30");
    await page.getByPlaceholder("Enter notes about your").fill("fixed hours");
    await page.waitForTimeout(200); // TODO (dani) avoid this
    await page.getByRole("button", { name: "Re-submit invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).not.toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Awaiting approval" })).toBeVisible();

    await logout(page);
    await login(page, adminUser);

    await expect(locateOpenInvoicesBadge(page)).toContainText("1");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    const fixedInvoiceRow = page
      .locator("tbody tr")
      .filter({ hasText: workerUserA.legalName ?? "never" })
      .filter({ hasText: "$150" });

    await expect(fixedInvoiceRow).toBeVisible();
    await fixedInvoiceRow.click();

    await page.getByRole("button", { name: "Reject" }).click();
    await page.getByLabel("Explain why the invoice was").fill("sorry still wrong");
    await page.getByRole("button", { name: "Yes, reject" }).click();

    await expect(locateOpenInvoicesBadge(page)).not.toBeVisible();
  });

  const locateOpenInvoicesBadge = (page: Page) => page.getByRole("link", { name: "Invoices" }).getByRole("status");
});
