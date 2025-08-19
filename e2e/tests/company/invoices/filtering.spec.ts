import type { Page } from "@playwright/test";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { invoiceApprovalsFactory } from "@test/factories/invoiceApprovals";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq, sql } from "drizzle-orm";
import { invoiceStatuses } from "@/db/enums";
import { users } from "@/db/schema";
import { assert } from "@/utils/assert";

const selectStatusFilter = async (page: Page, statusName: string) => {
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("menuitem", { name: "Status" }).click();
  await page.getByRole("menuitemcheckbox", { name: statusName }).click();
};

const createInvoiceWithApprovals = async (
  companyId: bigint,
  approvalCount = 0,
  overrides: {
    contractorRole?: string;
    amount?: bigint;
    invoiceNumber?: string;
  } = {},
) => {
  const { companyContractor } = await companyContractorsFactory.create({
    companyId,
    role: overrides.contractorRole || `Contractor-${approvalCount}approval`,
  });
  const { invoice } = await invoicesFactory.create({
    companyId,
    companyContractorId: companyContractor.id,
    status: approvalCount > 0 ? "approved" : "received",
    totalAmountInUsdCents: overrides.amount || BigInt(1000_00 + approvalCount * 100_00),
    invoiceNumber: overrides.invoiceNumber || `INV-${approvalCount}APP-${Date.now()}`,
  });

  for (let i = 0; i < approvalCount; i++) {
    await invoiceApprovalsFactory.create({ invoiceId: invoice.id });
  }

  return { invoice, companyContractor };
};

const createInvoiceWithStatus = async (
  companyId: bigint,
  status: (typeof invoiceStatuses)[number],
  overrides: {
    contractorRole?: string;
    amount?: bigint;
    invoiceNumber?: string;
  } = {},
) => {
  const { companyContractor } = await companyContractorsFactory.create({
    companyId,
    role: overrides.contractorRole || `Contractor-${status}`,
  });
  const { invoice } = await invoicesFactory.create({
    companyId,
    companyContractorId: companyContractor.id,
    status,
    totalAmountInUsdCents: overrides.amount || BigInt(2000_00 + Math.floor(Math.random() * 1000_00)),
    invoiceNumber: overrides.invoiceNumber || `INV-${status.toUpperCase()}-${Date.now()}`,
  });

  return { invoice, companyContractor };
};

const setupTestFixture = async () => {
  const { company } = await companiesFactory.create({
    isTrusted: true,
    requiredInvoiceApprovalCount: 2,
  });
  const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
  const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) });
  assert(adminUser !== undefined);

  const { companyContractor } = await companyContractorsFactory.create({
    companyId: company.id,
    role: "Main Contractor",
  });
  const contractorUser = await db.query.users.findFirst({ where: eq(users.id, companyContractor.userId) });
  assert(contractorUser !== undefined);

  await companyStripeAccountsFactory.create({ companyId: company.id });

  const testInvoices = {
    zeroApproval: await createInvoiceWithApprovals(company.id, 0, {
      contractorRole: "Zero Approval Dev",
      amount: BigInt(500_00),
    }),
    oneApproval: await createInvoiceWithApprovals(company.id, 1, {
      contractorRole: "One Approval Dev",
      amount: BigInt(750_00),
    }),
    fullyApproved: await createInvoiceWithApprovals(company.id, 2, {
      contractorRole: "Fully Approved Dev",
      amount: BigInt(1200_00),
    }),
    rejected: await createInvoiceWithStatus(company.id, "rejected", {
      contractorRole: "Rejected Dev",
      amount: BigInt(1500_00),
    }),
    paid: await createInvoiceWithStatus(company.id, "paid", {
      contractorRole: "Paid Dev",
      amount: BigInt(1900_00),
    }),
    failed: await createInvoiceWithStatus(company.id, "failed", {
      contractorRole: "Failed Dev",
      amount: BigInt(2000_00),
    }),
    processing: await createInvoiceWithStatus(company.id, "processing", {
      contractorRole: "Processing Dev",
      amount: BigInt(1700_00),
    }),
    paymentPending: await createInvoiceWithStatus(company.id, "payment_pending", {
      contractorRole: "Payment Pending Dev",
      amount: BigInt(1800_00),
    }),
  };

  const { companyContractor: frontendContractor } = await companyContractorsFactory.create({
    companyId: company.id,
    role: "Frontend Developer",
  });
  const { companyContractor: backendContractor } = await companyContractorsFactory.create({
    companyId: company.id,
    role: "Backend Developer",
  });

  const frontendInvoice = await invoicesFactory.create({
    companyId: company.id,
    companyContractorId: frontendContractor.id,
    status: "received",
    totalAmountInUsdCents: BigInt(1100_00),
  });

  const backendInvoice = await invoicesFactory.create({
    companyId: company.id,
    companyContractorId: backendContractor.id,
    status: "rejected",
    totalAmountInUsdCents: BigInt(1300_00),
  });

  const contractorInvoice = await invoicesFactory.create({
    companyId: company.id,
    companyContractorId: companyContractor.id,
    status: "received",
    totalAmountInUsdCents: BigInt(800_00),
    invoiceNumber: "INV-CONTRACTOR-001",
  });

  return {
    company,
    adminUser,
    contractorUser,
    invoices: testInvoices,
    searchInvoices: { frontend: frontendInvoice, backend: backendInvoice },
    contractorInvoice,
  };
};

test.describe.configure({ mode: "serial" });

test.describe("Invoice Status Filtering", () => {
  let fixture: Awaited<ReturnType<typeof setupTestFixture>>;

  test.beforeEach(async () => {
    fixture = await setupTestFixture();
  });

  test.afterEach(async () => {
    await db.execute(sql`
      DELETE FROM invoice_approvals WHERE invoice_id IN (
        SELECT id FROM invoices WHERE company_id = ${fixture.company.id}
      )
    `);
    await db.execute(sql`DELETE FROM invoices WHERE company_id = ${fixture.company.id}`);
    await db.execute(sql`DELETE FROM company_contractors WHERE company_id = ${fixture.company.id}`);
    await db.execute(sql`DELETE FROM company_administrators WHERE company_id = ${fixture.company.id}`);
    await db.execute(sql`DELETE FROM company_stripe_accounts WHERE company_id = ${fixture.company.id}`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${fixture.adminUser.id}, ${fixture.contractorUser.id})`);
    await db.execute(sql`DELETE FROM companies WHERE id = ${fixture.company.id}`);
  });

  test("shows all expected status options in dropdown", async ({ page }) => {
    await login(page, fixture.adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Status" }).click();

    const expectedStatuses = ["Awaiting approval", "Approved", "Processing", "Paid", "Rejected", "Failed"];
    for (const status of expectedStatuses) {
      await expect(page.getByRole("menuitemcheckbox", { name: status })).toBeVisible();
    }
  });

  test("contractor can filter by visible status types", async ({ page }) => {
    await login(page, fixture.contractorUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    const invoiceRows = page.locator("tbody tr");
    await expect(invoiceRows).toHaveCount(1);
    await expect(page.getByText("INV-CONTRACTOR-001")).toBeVisible();
    await expect(page.getByText("$800")).toBeVisible();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Status" }).click();

    const expectedStatuses = ["Awaiting approval", "Approved", "Processing", "Paid", "Rejected", "Failed"];
    for (const status of expectedStatuses) {
      await expect(page.getByRole("menuitemcheckbox", { name: status })).toBeVisible();
    }

    await page.getByRole("menuitemcheckbox", { name: "Awaiting approval" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("INV-CONTRACTOR-001")).toBeVisible();

    await selectStatusFilter(page, "Awaiting approval");
    await selectStatusFilter(page, "Paid");
    await expect(page.getByText("No results.")).toBeVisible();
  });

  test("shows approval progress in multi-approval workflow", async ({ page }) => {
    await login(page, fixture.adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    await selectStatusFilter(page, "Failed");

    const invoiceRows = page.locator("tbody tr");
    await expect(invoiceRows).toHaveCount(4);
    await expect(page.getByText("Awaiting approval (0/2)").first()).toBeVisible();
    await expect(page.getByText("Awaiting approval (1/2)")).toBeVisible();
  });

  test("moves invoice from 'Awaiting approval' to 'Approved' after final approval", async ({ page }) => {
    await login(page, fixture.adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    await selectStatusFilter(page, "Failed");

    let invoiceRows = page.locator("tbody tr");
    await expect(invoiceRows).toHaveCount(4);
    await expect(page.getByText("Awaiting approval (1/2)").first()).toBeVisible();
    await invoiceApprovalsFactory.create({ invoiceId: fixture.invoices.oneApproval.invoice.id });
    await page.reload();

    await selectStatusFilter(page, "Awaiting approval");
    await selectStatusFilter(page, "Failed");

    await selectStatusFilter(page, "Approved");
    invoiceRows = page.locator("tbody tr");
    await expect(invoiceRows).toHaveCount(2);
    await expect(page.locator("tbody tr").getByText("Approved", { exact: true }).first()).toBeVisible();
    await selectStatusFilter(page, "Approved");
    await selectStatusFilter(page, "Awaiting approval");
    await expect(page.locator("tbody tr")).toHaveCount(3);
  });
  test("filters by 'Processing' status shows processing and payment pending invoices", async ({ page }) => {
    await login(page, fixture.adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    await selectStatusFilter(page, "Awaiting approval");
    await selectStatusFilter(page, "Failed");

    await selectStatusFilter(page, "Processing");
    const invoiceRows = page.locator("tbody tr");
    await expect(invoiceRows).toHaveCount(2);
    await expect(page.getByText("Processing Dev")).toBeVisible();
    await expect(page.getByText("Payment Pending Dev")).toBeVisible();
    await expect(page.getByText("$1,700")).toBeVisible();
    await expect(page.getByText("$1,800")).toBeVisible();
    await expect(page.getByText("Payment in progress")).toBeVisible();
    await expect(page.getByText("Payment scheduled")).toBeVisible();
    await expect(page.getByText("Zero Approval Dev")).not.toBeVisible();
    await expect(page.getByText("$500")).not.toBeVisible();
  });

  test("admin can filter invoices by all status types", async ({ page }) => {
    await login(page, fixture.adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    const statusTests = [
      {
        status: "Awaiting approval",
        expectedContractors: ["Zero Approval Dev", "One Approval Dev", "Frontend Developer", "Main Contractor"],
        hiddenContractors: [
          "Fully Approved Dev",
          "Processing Dev",
          "Paid Dev",
          "Rejected Dev",
          "Failed Dev",
          "Payment Pending Dev",
        ],
      },
      {
        status: "Approved",
        expectedContractors: ["Fully Approved Dev"],
        hiddenContractors: [
          "Zero Approval Dev",
          "One Approval Dev",
          "Processing Dev",
          "Paid Dev",
          "Rejected Dev",
          "Failed Dev",
          "Payment Pending Dev",
        ],
      },
      {
        status: "Processing",
        expectedContractors: ["Processing Dev", "Payment Pending Dev"],
        hiddenContractors: [
          "Zero Approval Dev",
          "One Approval Dev",
          "Fully Approved Dev",
          "Paid Dev",
          "Rejected Dev",
          "Failed Dev",
        ],
      },
      {
        status: "Paid",
        expectedContractors: ["Paid Dev"],
        hiddenContractors: [
          "Zero Approval Dev",
          "One Approval Dev",
          "Fully Approved Dev",
          "Processing Dev",
          "Rejected Dev",
          "Failed Dev",
          "Payment Pending Dev",
        ],
      },
      {
        status: "Rejected",
        expectedContractors: ["Rejected Dev", "Backend Developer"],
        hiddenContractors: [
          "Zero Approval Dev",
          "One Approval Dev",
          "Fully Approved Dev",
          "Processing Dev",
          "Paid Dev",
          "Failed Dev",
          "Payment Pending Dev",
        ],
      },
      {
        status: "Failed",
        expectedContractors: ["Failed Dev"],
        hiddenContractors: [
          "Zero Approval Dev",
          "One Approval Dev",
          "Fully Approved Dev",
          "Processing Dev",
          "Paid Dev",
          "Rejected Dev",
          "Payment Pending Dev",
        ],
      },
    ];

    for (let i = 0; i < statusTests.length; i++) {
      const testCase = statusTests[i];
      const previousTestCase = statusTests[i - 1];

      if (!testCase) continue;

      if (i === 0) {
        await selectStatusFilter(page, "Awaiting approval");
        await selectStatusFilter(page, "Failed");
      }

      if (previousTestCase) {
        await selectStatusFilter(page, previousTestCase.status);
      }

      await selectStatusFilter(page, testCase.status);

      const invoiceRows = page.locator("tbody tr");
      await expect(invoiceRows).toHaveCount(testCase.expectedContractors.length);

      for (const expectedContractor of testCase.expectedContractors) {
        await expect(page.getByText(expectedContractor)).toBeVisible();
      }

      for (const hiddenContractor of testCase.hiddenContractors) {
        await expect(page.getByText(hiddenContractor)).not.toBeVisible();
      }
    }
  });

  test("admin default filter shows awaiting approval and failed invoices", async ({ page }) => {
    await login(page, fixture.adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    // Admin default filter should show 5 invoices (4 awaiting approval + 1 failed)
    const invoiceRows = page.locator("tbody tr");
    await expect(invoiceRows).toHaveCount(5);

    await expect(page.getByText("Zero Approval Dev")).toBeVisible();
    await expect(page.getByText("One Approval Dev")).toBeVisible();
    await expect(page.getByText("Frontend Developer")).toBeVisible();
    await expect(page.getByText("Main Contractor")).toBeVisible();

    await expect(page.getByText("Failed Dev")).toBeVisible();

    await expect(page.getByText("Fully Approved Dev")).not.toBeVisible();
    await expect(page.getByText("Processing Dev")).not.toBeVisible();
    await expect(page.getByText("Paid Dev")).not.toBeVisible();
    await expect(page.getByText("Rejected Dev")).not.toBeVisible();
    await expect(page.getByText("Payment Pending Dev")).not.toBeVisible();
    await expect(page.getByText("Backend Developer")).not.toBeVisible();
  });
});
