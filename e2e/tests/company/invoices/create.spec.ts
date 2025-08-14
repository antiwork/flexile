import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { subDays } from "date-fns";
import { and, desc, eq } from "drizzle-orm";
import {
  activeStorageAttachments,
  companies,
  companyContractors,
  expenseCategories,
  invoiceExpenses,
  invoiceLineItems,
  invoices,
  users,
} from "@/db/schema";

test.describe("invoice creation", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;
  let companyContractor: typeof companyContractors.$inferSelect;

  test.beforeEach(async () => {
    company = (
      await companiesFactory.createCompletedOnboarding({
        equityEnabled: true,
      })
    ).company;

    contractorUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "22222",
        streetAddress: "1st St.",
      })
    ).user;

    companyContractor = (
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: contractorUser.id,
        payRateInSubunits: 6000,
        equityPercentage: 20,
      })
    ).companyContractor;
  });

  test("considers the invoice year when calculating equity", async ({ page }) => {
    const companyInvestor = (await companyInvestorsFactory.create({ userId: contractorUser.id, companyId: company.id }))
      .companyInvestor;
    await equityGrantsFactory.createActive(
      {
        companyInvestorId: companyInvestor.id,
        sharePriceUsd: "300",
      },
      { year: 2021 },
    );

    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("I worked on invoices");
    await page.getByLabel("Hours").fill("03:25");
    await expect(page.getByText("Total services$60")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$0")).toBeVisible();
    await expect(page.getByText("Net amount in cash$60")).toBeVisible();

    await fillDatePicker(page, "Date", "08/08/2021");
    await page.waitForTimeout(300);
    await page.getByLabel("Hours / Qty").fill("100:00");
    await page.waitForTimeout(300);
    await page.getByPlaceholder("Description").fill("I worked on invoices");

    await expect(page.getByText("Total services$6,000")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$1,200")).toBeVisible();
    await expect(page.getByText("Net amount in cash$4,800")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.locator("tbody")).toContainText(
      ["Invoice ID", "1", "Sent on", "Aug 8, 2021", "Amount", "$6,000", "Status", "Awaiting approval (0/2)"].join(""),
    );

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.totalAmountInUsdCents).toBe(600000n);
    expect(invoice.cashAmountInCents).toBe(480000n);
    expect(invoice.equityAmountInCents).toBe(120000n);
    expect(invoice.equityPercentage).toBe(20);
  });

  test("allows creation of an invoice as an alumni", async ({ page }) => {
    await db
      .update(companyContractors)
      .set({ startedAt: subDays(new Date(), 365), endedAt: subDays(new Date(), 100) })
      .where(eq(companyContractors.id, companyContractor.id));

    await login(page, contractorUser, "/invoices/new");
    await page.getByPlaceholder("Description").fill("item name");
    await page.getByLabel("Hours / Qty").fill("01:00");
    await page.getByPlaceholder("Enter notes about your").fill("sent as alumni");
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("cell", { name: "Awaiting approval (0/2)" })).toBeVisible();
  });

  test("does not show equity split if equity compensation is disabled", async ({ page }) => {
    await db.update(companies).set({ equityEnabled: false }).where(eq(companies.id, company.id));

    await login(page, contractorUser, "/invoices/new");
    await expect(page.getByText("Total")).toBeVisible();
    await expect(page.getByText("Swapped for equity")).not.toBeVisible();
  });

  test("creates an invoice with only expenses, no line items", async ({ page }) => {
    await db.insert(expenseCategories).values({
      companyId: company.id,
      name: "Office Supplies",
    });
    await login(page, contractorUser, "/invoices/new");

    await page.getByRole("button", { name: "Add expense" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("test expense receipt"),
    });

    await page.getByLabel("Merchant").fill("Office Supplies Inc");
    await page.getByLabel("Amount").fill("45.99");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.locator("tbody")).toContainText("$45.99");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.totalAmountInUsdCents).toBe(4599n);
    const expense = await db.query.invoiceExpenses
      .findFirst({ where: eq(invoiceExpenses.invoiceId, invoice.id) })
      .then(takeOrThrow);
    expect(expense.totalAmountInCents).toBe(4599n);
  });

  test("allows adding multiple expense rows", async ({ page }) => {
    await db.insert(expenseCategories).values([
      { companyId: company.id, name: "Office Supplies" },
      { companyId: company.id, name: "Travel" },
    ]);
    await login(page, contractorUser, "/invoices/new");

    await page.getByRole("button", { name: "Add expense" }).click();
    await page.locator('input[accept="application/pdf, image/*"]').setInputFiles({
      name: "receipt1.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("first expense receipt"),
    });

    await page.getByLabel("Merchant").fill("Office Supplies Inc");
    await page.getByLabel("Amount").fill("25.50");

    await page.getByRole("button", { name: "Add expense" }).click();
    await page.locator('input[accept="application/pdf, image/*"]').setInputFiles({
      name: "receipt2.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("second expense receipt"),
    });

    const merchantInputs = page.getByLabel("Merchant");
    await merchantInputs.nth(1).fill("Travel Agency");

    const amountInputs = page.getByLabel("Amount");
    await amountInputs.nth(1).fill("150.75");

    await expect(page.getByText("Total expenses$176.25")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.locator("tbody")).toContainText("$176.25");

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.totalAmountInUsdCents).toBe(17625n);

    const expenses = await db.query.invoiceExpenses.findMany({
      where: eq(invoiceExpenses.invoiceId, invoice.id),
    });
    expect(expenses).toHaveLength(2);
    expect(expenses[0]?.totalAmountInCents).toBe(2550n);
    expect(expenses[1]?.totalAmountInCents).toBe(15075n);
  });

  test("shows legal details warning when tax information is not confirmed", async ({ page }) => {
    const userWithoutTax = (
      await usersFactory.create(
        {
          streetAddress: "123 Main St",
          zipCode: "12345",
          city: "Test City",
          state: "CA",
          countryCode: "US",
        },
        { withoutComplianceInfo: true },
      )
    ).user;

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: userWithoutTax.id,
      payRateInSubunits: 5000,
    });

    await login(page, userWithoutTax);

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("Please provide your legal details before creating new invoices.")).toBeVisible();
  });

  test("shows alert when billing above default pay rate", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByLabel("Hours").fill("2:00");
    await page.getByPlaceholder("Description").fill("Premium work");
    await expect(page.getByText("This invoice includes rates above your default")).not.toBeVisible();

    await page.getByLabel("Rate").fill("75");
    await expect(
      page.getByText("This invoice includes rates above your default of $60/hour. Please check before submitting."),
    ).toBeVisible();

    await page.getByLabel("Rate").fill("60");
    await expect(page.getByText("This invoice includes rates above your default")).not.toBeVisible();

    await db
      .update(companyContractors)
      .set({ payRateInSubunits: null })
      .where(eq(companyContractors.id, companyContractor.id));
    await page.reload();
    await expect(page.getByText("This invoice includes rates above your default")).not.toBeVisible();
  });

  test("supports decimal quantities", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByLabel("Hours").fill("2.5");
    await page.getByPlaceholder("Description").fill("Development work with decimal quantities");
    await fillDatePicker(page, "Date", "12/15/2024");

    await expect(page.getByText("Total services$150")).toBeVisible();

    // contractor has 20% equity, so $150 * 0.8 = $120
    await expect(page.getByText("Net amount in cash$120")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    // wait for navigation to invoice list
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.locator("tbody")).toContainText("$150");

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    expect(invoice.totalAmountInUsdCents).toBe(15000n);

    const lineItem = await db.query.invoiceLineItems
      .findFirst({ where: eq(invoiceLineItems.invoiceId, invoice.id) })
      .then(takeOrThrow);

    expect(Number(lineItem.quantity)).toBe(2.5);
  });

  test("creates an invoice with an attached document", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Fill out basic invoice information
    await page.getByPlaceholder("Description").fill("Invoice with document attachment");
    await page.getByLabel("Hours").fill("05:00");

    // Add the document attachment
    await page.getByRole("button", { name: "Add Document" }).click();
    await page
      .locator('input[accept="application/pdf, image/*, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt"]')
      .setInputFiles({
        name: "invoice-attachment.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("test invoice attachment document"),
      });

    // Add a delay to ensure the file upload is properly processed
    await page.waitForTimeout(500);

    // Verify document is displayed in the table
    await expect(page.getByText("invoice-attachment.pdf")).toBeVisible();

    // Submit the invoice
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Verify invoice was created with attachment
    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    // Check that the invoice record exists in the database
    expect(invoice).toBeDefined();

    // Verify there's an attachment for this invoice in ActiveStorage
    const attachment = await db.query.activeStorageAttachments.findFirst({
      where: and(
        eq(activeStorageAttachments.recordType, "Invoice"),
        eq(activeStorageAttachments.recordId, invoice.id),
        eq(activeStorageAttachments.name, "attachments"),
      ),
      with: { blob: { columns: { key: true, filename: true } } },
    });

    expect(attachment?.blob.filename).toBe("invoice-attachment.pdf");
  });

  test("allows viewing and editing an invoice with attachment", async ({ page }) => {
    // First create an invoice with attachment
    await login(page, contractorUser, "/invoices/new");

    // Fill out basic invoice information
    await page.getByPlaceholder("Description").fill("Invoice for document editing test");
    await page.getByLabel("Hours").fill("02:00");
    await page.getByLabel("Rate").fill("30");

    // Add the document attachment
    await page.getByRole("button", { name: "Add Document" }).click();
    await page
      .locator('input[accept="application/pdf, image/*, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt"]')
      .setInputFiles({
        name: "test-document.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("test invoice document"),
      });

    // Add a delay to ensure the file upload is properly processed
    await page.waitForTimeout(500);

    // Submit the invoice
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    // Wait for the invoice to appear in the table with an invoice ID
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    // Click on the specific table cell containing the invoice ID to view details
    await page.locator("tbody").first().click();

    // Check that document is displayed
    await expect(page.getByText("test-document.pdf")).toBeVisible();

    // Edit the invoice
    await page.getByRole("link", { name: "Edit" }).click();

    // Verify document still shows in edit mode
    await expect(page.getByText("test-document.pdf")).toBeVisible();

    // Remove the document and upload a new one
    // Target the specific Remove button in the document row
    await page.getByRole("row", { name: "test-document.pdf" }).getByLabel("Remove").click();

    // Add a delay to ensure the document removal is properly processed
    await page.waitForTimeout(300); // Add a new document
    await page.getByRole("button", { name: "Add Document" }).click();
    await page
      .locator('input[accept="application/pdf, image/*, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt"]')
      .setInputFiles({
        name: "updated-document.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("updated invoice document content"),
      });

    // Add a delay to ensure the file upload is properly processed
    await page.waitForTimeout(300);

    // Submit the updated invoice
    await page.getByRole("button", { name: "Re-submit invoice" }).click();

    // Verify we're back at the invoice details page
    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "Awaiting approval (0/2)" })).toBeVisible();

    await page.locator("tbody").first().click();

    // Wait for the updated document to be visible, which confirms the update was successful
    await expect(page.getByText("updated-document.pdf")).toBeVisible();
  });
});
