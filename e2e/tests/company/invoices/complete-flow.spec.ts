import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoiceLineItemsFactory } from "@test/factories/invoiceLineItems";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { fillByLabel } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { createAndSendInvoice, openInvoiceEditById } from "@test/helpers/invoices";
import { expect, type Page, test, withinModal } from "@test/index";
import { and, eq } from "drizzle-orm";
import { invoiceStatuses } from "@/db/enums";
import { invoices } from "@/db/schema";

type User = Awaited<ReturnType<typeof usersFactory.create>>["user"];

test.describe("Invoice submission, approval and rejection", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: User, workerUserA: User, workerUserB: User;

  test.beforeEach(async () => {
    ({ company, adminUser } = await companiesFactory.createCompletedOnboarding({
      requiredInvoiceApprovalCount: 1,
      isTrusted: true,
    }));
    workerUserA = (await usersFactory.create()).user;
    workerUserB = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: workerUserA.id,
      id: workerUserA.id,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: workerUserB.id,
      id: workerUserB.id,
    });
  });

  const createInitialInvoices = async (statusOverrides?: Record<string, (typeof invoiceStatuses)[number]>) => {
    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: workerUserA.id,
      status: statusOverrides?.["CUSTOM-1"] ?? "received",
      invoiceNumber: "CUSTOM-1",
      invoiceDate: "2024-11-01",
      totalAmountInUsdCents: BigInt(870_00),
      cashAmountInCents: BigInt(870_00),
    });

    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: workerUserA.id,
      status: statusOverrides?.["CUSTOM-2"] ?? "received",
      invoiceNumber: "CUSTOM-2",
      invoiceDate: "2024-12-01",
      totalAmountInUsdCents: BigInt(23_00),
      cashAmountInCents: BigInt(23_00),
    });

    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: workerUserB.id,
      status: statusOverrides?.["CUSTOM-3"] ?? "received",
      invoiceNumber: "CUSTOM-3",
      invoiceDate: "2024-11-20",
      totalAmountInUsdCents: BigInt(623_00),
      cashAmountInCents: BigInt(623_00),
    });
  };

  const createRejectedInvoice = async () => {
    const { invoice } = await invoicesFactory.create(
      {
        companyId: company.id,
        companyContractorId: workerUserA.id,
        status: "rejected",
        invoiceNumber: "REJECTED-1",
        invoiceDate: "2024-12-01",
        totalAmountInUsdCents: BigInt(23_00),
        cashAmountInCents: BigInt(23_00),
        rejectedById: adminUser.id,
        rejectionReason: "Too little time",
        rejectedAt: new Date(),
      },
      { skipLineItems: true },
    );

    await invoiceLineItemsFactory.create({
      invoiceId: invoice.id,
      description: "woops too little time",
      quantity: "0.383", // 0:23 hours = 0.383 hours
    });

    return invoice;
  };

  test("allows contractor to create and submit multiple invoices", async ({ page }) => {
    await login(page, workerUserA);

    await createAndSendInvoice(page, {
      invoiceId: "CUSTOM-1",
      date: "11/01/2024",
      items: [
        { description: "first item", hoursOrQty: "01:23" },
        { description: "second item", hoursOrQty: "10" },
      ],
      notes: "A note in the invoice",
      expectTotalText: "$683",
    });
    await expect(
      page.getByTableRowCustom({
        "Invoice ID": "CUSTOM-1",
        "Sent on": "Nov 1, 2024",
        Amount: "$683",
        Status: "Awaiting approval",
      }),
    ).toBeVisible();

    const invoice1 = await db.query.invoices.findFirst({
      where: and(eq(invoices.companyId, company.id), eq(invoices.invoiceNumber, "CUSTOM-1")),
    });
    expect(invoice1).toEqual(
      expect.objectContaining({
        status: "received",
        totalAmountInUsdCents: 68300n,
        cashAmountInCents: 68300n,
        companyId: company.id,
        companyContractorId: workerUserA.id,
        userId: workerUserA.id,
      }),
    );

    await createAndSendInvoice(page, {
      invoiceId: "CUSTOM-2",
      date: "12/01/2024",
      items: [{ description: "woops too little time", hoursOrQty: "0:23" }],
    });
    await expect(
      page.getByTableRowCustom({
        "Invoice ID": "CUSTOM-2",
        "Sent on": "Dec 1, 2024",
        Amount: "$23",
        Status: "Awaiting approval",
      }),
    ).toBeVisible();

    const invoice2 = await db.query.invoices.findFirst({
      where: and(eq(invoices.companyId, company.id), eq(invoices.invoiceNumber, "CUSTOM-2")),
    });
    expect(invoice2).toEqual(
      expect.objectContaining({
        status: "received",
        totalAmountInUsdCents: 2300n,
        cashAmountInCents: 2300n,
        companyId: company.id,
        companyContractorId: workerUserA.id,
        userId: workerUserA.id,
      }),
    );
  });

  test("allows contractor to edit and resubmit invoices", async ({ page }) => {
    await login(page, workerUserA);

    await createAndSendInvoice(page, {
      invoiceId: "CUSTOM-1",
      date: "11/01/2024",
      items: [
        { description: "first item", hoursOrQty: "01:23" },
        { description: "second item", hoursOrQty: "10" },
      ],
      notes: "A note in the invoice",
      expectTotalText: "$683",
    });
    await expect(
      page.getByTableRowCustom({
        "Invoice ID": "CUSTOM-1",
        "Sent on": "Nov 1, 2024",
        Amount: "$683",
        Status: "Awaiting approval",
      }),
    ).toBeVisible();

    await openInvoiceEditById(page, "CUSTOM-1");
    await page.getByPlaceholder("Description").first().fill("first item updated");
    await fillByLabel(page, "Hours / Qty", "04:30", { index: 0 });
    await expect(page.getByText("$870", { exact: true })).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/internal/companies/") && r.status() === 204),
      page.waitForResponse((r) => r.url().includes("invoices.list") && r.status() >= 200 && r.status() < 300),
      page.getByRole("button", { name: "Resubmit" }).click(),
    ]);

    await expect(page.getByRole("cell", { name: "$870" })).toBeVisible();
    await expect(locateOpenInvoicesBadge(page)).not.toBeVisible();
  });

  test("allows contractor to delete invoices", async ({ page }) => {
    await login(page, workerUserA);

    await createAndSendInvoice(page, {
      invoiceId: "CUSTOM-3",
      date: "12/01/2024",
      items: [{ description: "Invoice to be deleted", hoursOrQty: "0:33" }],
    });
    await expect(
      page.getByTableRowCustom({
        "Invoice ID": "CUSTOM-3",
        "Sent on": "Dec 1, 2024",
        Amount: "$33",
        Status: "Awaiting approval",
      }),
    ).toBeVisible();

    await page.getByRole("cell", { name: "CUSTOM-3" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Delete" }).click();
      },
      { page },
    );
    await expect(page.getByRole("cell", { name: "CUSTOM-3" })).not.toBeVisible();
  });

  test("allows multiple contractors to submit invoices", async ({ page }) => {
    await login(page, workerUserA);
    await createAndSendInvoice(page, {
      invoiceId: "CUSTOM-1",
      date: "11/01/2024",
      items: [{ description: "first item", hoursOrQty: "01:23" }],
    });
    await expect(page.getByText("Awaiting approval")).toBeVisible();

    const invoice1 = await db.query.invoices.findFirst({
      where: and(eq(invoices.companyId, company.id), eq(invoices.invoiceNumber, "CUSTOM-1")),
    });
    expect(invoice1).toEqual(
      expect.objectContaining({
        status: "received",
        totalAmountInUsdCents: 8300n,
        cashAmountInCents: 8300n,
        companyId: company.id,
        companyContractorId: workerUserA.id,
        userId: workerUserA.id,
      }),
    );

    await logout(page);
    await login(page, workerUserB);
    await createAndSendInvoice(page, {
      invoiceId: "CUSTOM-3",
      date: "11/20/2024",
      items: [{ description: "line item", hoursOrQty: "10:23" }],
    });
    await expect(page.getByText("Awaiting approval")).toBeVisible();

    const invoice2 = await db.query.invoices.findFirst({
      where: and(eq(invoices.companyId, company.id), eq(invoices.invoiceNumber, "CUSTOM-3")),
    });
    expect(invoice2).toEqual(
      expect.objectContaining({
        status: "received",
        totalAmountInUsdCents: 62300n,
        cashAmountInCents: 62300n,
        companyId: company.id,
        companyContractorId: workerUserB.id,
        userId: workerUserB.id,
      }),
    );
  });

  test("allows admin to view and manage pending invoices", async ({ page }) => {
    await login(page, adminUser);
    await createInitialInvoices();

    await expect(locateOpenInvoicesBadge(page)).toContainText("3");
    await expect(
      page
        .getByTableRowCustom({
          "Sent on": "Dec 1, 2024",
          Amount: "$23",
          Status: "Awaiting approval",
        })
        .getByRole("button", { name: "Pay now" }),
    ).toBeVisible();
    await expect(
      page
        .getByTableRowCustom({
          "Sent on": "Nov 20, 2024",
          Amount: "$623",
          Status: "Awaiting approval",
        })
        .getByRole("button", { name: "Pay now" }),
    ).toBeVisible();
    await expect(
      page
        .getByTableRowCustom({
          "Sent on": "Nov 1, 2024",
          Amount: "$870",
          Status: "Awaiting approval",
        })
        .getByRole("button", { name: "Pay now" }),
    ).toBeVisible();
  });

  test("allows admin to approve individual invoices", async ({ page }) => {
    await login(page, adminUser);
    await createInitialInvoices();
    await expect(locateOpenInvoicesBadge(page)).toContainText("3");
    const thirdRow = page.getByTableRowCustom({
      "Sent on": "Nov 1, 2024",
      Amount: "$870",
    });

    await thirdRow.getByRole("button", { name: "Pay now" }).click();

    await expect(thirdRow).not.toBeVisible();
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Clear all filters" }).click();
    await expect(thirdRow).toContainText("Payment scheduled");
    await expect(locateOpenInvoicesBadge(page)).toContainText("2");
  });

  test("allows admin to bulk approve and reject invoices", async ({ page }) => {
    await login(page, adminUser);
    await createInitialInvoices();
    await db
      .update(invoices)
      .set({ status: "payment_pending" })
      .where(and(eq(invoices.invoiceNumber, "CUSTOM-1"), eq(invoices.companyContractorId, workerUserA.id)));

    await expect(locateOpenInvoicesBadge(page)).toContainText("2");

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

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await page.getByRole("checkbox", { name: "Select all" }).uncheck();
    await page
      .locator("tbody tr")
      .filter({ hasText: workerUserA.legalName ?? "never" })
      .filter({ hasText: "$23" })
      .getByLabel("Select row")
      .check();
    await page.getByRole("button", { name: "Reject selected invoices" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByLabel("Explain why the invoice was").fill("Too little time");
        await modal.getByRole("button", { name: "Yes, reject" }).click();
      },
      { page },
    );

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Clear all filters" }).click();

    const rejectedInvoiceRow0 = page
      .locator("tbody tr")
      .filter({ hasText: workerUserA.legalName ?? "never" })
      .filter({ hasText: "$23" });
    await expect(rejectedInvoiceRow0).toContainText("Rejected");
    await expect(locateOpenInvoicesBadge(page)).toContainText("1");
  });

  test("allows admin to approve remaining invoices", async ({ page }) => {
    await login(page, adminUser);
    await createInitialInvoices({ "CUSTOM-1": "payment_pending", "CUSTOM-2": "rejected" });

    await expect(locateOpenInvoicesBadge(page)).toContainText("1");
    await page.getByRole("cell", { name: workerUserB.legalName ?? "never" }).click();
    await page.getByRole("link", { name: "View invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/invoices/approve") && r.status() === 204),
      page.locator("header").filter({ hasText: "Invoice" }).getByRole("button", { name: "Pay now" }).click(),
    ]);

    await expect(locateOpenInvoicesBadge(page)).not.toBeVisible();
  });

  test("allows contractor to view approved and rejected invoices", async ({ page }) => {
    await createInitialInvoices();
    await createInitialInvoices({ "CUSTOM-1": "payment_pending", "CUSTOM-2": "rejected" });
    await login(page, workerUserA);

    const approvedInvoiceRow = page.locator("tbody tr").filter({ hasText: "CUSTOM-1" });
    const rejectedInvoiceRow = page.locator("tbody tr").filter({ hasText: "CUSTOM-2" });

    await expect(approvedInvoiceRow.getByRole("cell", { name: "Payment scheduled" })).toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).toBeVisible();
  });

  test("allows contractor to edit and resubmit rejected invoice", async ({ page }) => {
    await createRejectedInvoice();

    await login(page, workerUserA);

    const rejectedInvoiceRow = page.locator("tbody tr").filter({ hasText: "REJECTED-1" });
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected", exact: true })).toBeVisible();

    await openInvoiceEditById(page, "REJECTED-1");
    await fillByLabel(page, "Hours / Qty", "02:30", { index: 0 });
    await page.getByPlaceholder("Enter notes about your").fill("fixed hours");
    await page.getByRole("button", { name: "Resubmit" }).click();

    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).not.toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Awaiting approval" })).toBeVisible();
  });

  test("allows admin to reject resubmitted invoices", async ({ page }) => {
    await login(page, workerUserA);
    await createRejectedInvoice();
    const rejectedInvoiceRow = page.locator("tbody tr").filter({ hasText: "REJECTED-1" });
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected", exact: true })).toBeVisible();

    await openInvoiceEditById(page, "REJECTED-1");
    await fillByLabel(page, "Hours / Qty", "02:30", { index: 0 });
    await page.getByPlaceholder("Enter notes about your").fill("fixed hours");
    await page.getByRole("button", { name: "Resubmit" }).click();

    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Rejected" })).not.toBeVisible();
    await expect(rejectedInvoiceRow.getByRole("cell", { name: "Awaiting approval" })).toBeVisible();

    await logout(page);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("invoices.list") && r.status() >= 200 && r.status() < 300),
      login(page, adminUser),
    ]);

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
