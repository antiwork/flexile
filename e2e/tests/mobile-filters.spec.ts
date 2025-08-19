import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";

test.describe("Mobile filters", () => {
  const mobileViewport = { width: 640, height: 800 };

  const expectTableCellsWithText = async (page: Page, text: string, expectedCount?: number) => {
    const cellsWithText = page.getByRole("cell").filter({ has: page.getByText(text, { exact: true }) });

    if (expectedCount !== undefined) {
      await expect(cellsWithText).toHaveCount(expectedCount);
    }
  };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(mobileViewport);
  });

  test("administrator can filter invoices using mobile status filter buttons", async ({ page }) => {
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding({
      requiredInvoiceApprovalCount: 1,
    });

    await invoicesFactory.create({ companyId: company.id, status: "received" });

    await invoicesFactory.create({
      companyId: company.id,
      status: "approved",
      invoiceApprovalsCount: 1,
    });

    await invoicesFactory.create({ companyId: company.id, status: "processing" });

    await invoicesFactory.create({ companyId: company.id, status: "payment_pending" });

    await invoicesFactory.create({ companyId: company.id, status: "paid" });

    await invoicesFactory.create({ companyId: company.id, status: "rejected" });

    await invoicesFactory.create({ companyId: company.id, status: "failed" });

    await login(page, adminUser);
    await page.goto("/invoices");

    await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();

    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Awaiting approval" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rejected" })).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Awaiting approval" }).click();
    await expectTableCellsWithText(page, "Awaiting approval", 2);
    await expectTableCellsWithText(page, "Approved", 0);
    await expectTableCellsWithText(page, "Paid", 0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    await page.getByRole("button", { name: "Paid" }).click();
    await expectTableCellsWithText(page, "Paid", 1);
    await expectTableCellsWithText(page, "Awaiting approval", 0);
    await expectTableCellsWithText(page, "Payment scheduled", 0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    await page.getByRole("button", { name: "Rejected" }).click();
    await expectTableCellsWithText(page, "Rejected", 1);
    await expectTableCellsWithText(page, "Awaiting approval", 0);
    await expectTableCellsWithText(page, "Failed", 0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expectTableCellsWithText(page, "Awaiting approval", 2);
    await expectTableCellsWithText(page, "Paid", 1);
  });

  test("administrator can filter people using mobile status filter buttons", async ({ page }) => {
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding();

    const { user: activeUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: activeUser.id,
      startedAt: new Date(2020, 0, 1),
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const { user: onboardingUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: onboardingUser.id,
      startedAt: futureDate,
    });

    const pastDate = new Date(2020, 0, 1);
    const endDate = new Date(2022, 0, 1);
    const { user: alumniUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: alumniUser.id,
      startedAt: pastDate,
      endedAt: endDate,
    });

    await login(page, adminUser);
    await page.goto("/people");

    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Onboarding" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alumni" })).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Active" }).click();
    await expectTableCellsWithText(page, "Active", 1);
    await expectTableCellsWithText(page, "Alumni", 0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    await page.getByRole("button", { name: "Alumni" }).click();
    await expectTableCellsWithText(page, "Alumni", 1);
    await expectTableCellsWithText(page, "Active", 0);
    await expectTableCellsWithText(page, "Onboarding", 0);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expectTableCellsWithText(page, "Active", 2);
    await expectTableCellsWithText(page, "Alumni", 1);
  });

  test("contractor can filter documents using mobile status filter buttons", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    await documentsFactory.create(
      {
        name: "Signed Document",
        companyId: company.id,
      },
      {
        signatures: [{ userId: user.id, title: "Signer" }],
        signed: true,
      },
    );

    await documentsFactory.create(
      {
        name: "Pending Document",
        companyId: company.id,
      },
      {
        signatures: [{ userId: user.id, title: "Signer" }],
        signed: false,
      },
    );

    await documentsFactory.create({
      name: "Draft Document",
      companyId: company.id,
    });

    await login(page, user);
    await page.goto("/documents");

    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signature required" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signed" })).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Signature required" }).click();
    await expectTableCellsWithText(page, "Signature required", 1);
    await expectTableCellsWithText(page, "Signed", 0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    await page.getByRole("button", { name: "Signed" }).click();
    await expectTableCellsWithText(page, "Signed", 2);
    await expectTableCellsWithText(page, "Signature required", 0);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expectTableCellsWithText(page, "Signature required", 1);
    await expectTableCellsWithText(page, "Signed", 2);
  });
});
