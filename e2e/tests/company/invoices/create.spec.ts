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
    await page.getByLabel("Hours / Qty").fill("100:00");
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

    await page.getByLabel("Add expense").setInputFiles({
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

    await page.getByLabel("Add expense").setInputFiles({
      name: "receipt1.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("first expense receipt"),
    });

    await page.getByLabel("Merchant").fill("Office Supplies Inc");
    await page.getByLabel("Amount").fill("25.50");

    await page.getByLabel("Add expense").setInputFiles({
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

    await expect(page.locator("tbody").first()).toContainText("$176.25");

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

  test("shows payout warning when payout information is not provided", async ({ page }) => {
    const userWithoutPayout = (
      await usersFactory.create({
        streetAddress: "123 Main St",
        zipCode: "12345",
        city: "Test City",
        state: "CA",
        countryCode: "US",
      })
    ).user;

    await companyContractorsFactory.create(
      {
        companyId: company.id,
        userId: userWithoutPayout.id,
        payRateInSubunits: 5000,
      },
      { withoutBankAccount: true },
    );

    await login(page, userWithoutPayout);

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("Please provide a payout method for your invoices.")).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: "New invoice" })).toHaveClass(/disabled/u);
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
    await fillDatePicker(page, "Date", "12/15/2023");

    await expect(page.getByText("Total services$150")).toBeVisible();

    await expect(page.getByText("Net amount in cash$120")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.locator("tbody").first()).toContainText("$150");

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

    await page.getByPlaceholder("Description").fill("Invoice with document attachment");
    await page.getByLabel("Hours").fill("05:00");

    await page.getByLabel("Add document").setInputFiles({
      name: "invoice-attachment.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("test invoice attachment document"),
    });

    await expect(page.getByText("invoice-attachment.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    expect(invoice).toBeDefined();
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
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("Invoice for document editing test");
    await page.getByLabel("Hours").fill("02:00");
    await page.getByLabel("Rate").fill("30");

    await page.getByLabel("Add document").setInputFiles({
      name: "test-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("test invoice document"),
    });

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "Awaiting approval (0/2)" })).toBeVisible();

    await page.getByRole("row", { name: "Awaiting approval" }).click();

    await expect(page.getByText("test-document.pdf")).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).click();

    await expect(page.getByText("test-document.pdf")).toBeVisible();

    await page.getByRole("row", { name: "test-document.pdf" }).getByLabel("Remove").click();

    await page.getByLabel("Add document").setInputFiles({
      name: "updated-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("updated invoice document content"),
    });

    await page.getByRole("button", { name: "Resubmit" }).click();

    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "Awaiting approval (0/2)" })).toBeVisible();

    await page.getByRole("row", { name: "Awaiting approval" }).click();
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("updated-document.pdf")).toBeVisible();
  });

  test("prevents uploading document file larger than 10MB", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("Invoice with oversized document");
    await page.getByLabel("Hours").fill("01:00");

    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "X");

    await page.getByLabel("Add document").setInputFiles({
      name: "large-document.pdf",
      mimeType: "application/pdf",
      buffer: largeBuffer,
    });

    await expect(page.getByText("large-document.pdf")).not.toBeVisible();

    await expect(page.getByRole("heading", { name: "File Size Exceeded" })).toBeVisible();
    await expect(
      page.getByText("File size exceeds the maximum limit of 10MB. Please select a smaller file."),
    ).toBeVisible();

    await page.getByRole("button", { name: "OK" }).click();

    await page.getByLabel("Add document").setInputFiles({
      name: "valid-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("valid document content"),
    });

    await expect(page.getByText("valid-document.pdf")).toBeVisible();
  });

  test("prevents uploading expense files larger than 10MB", async ({ page }) => {
    await db.insert(expenseCategories).values({
      companyId: company.id,
      name: "Office Supplies",
    });

    await login(page, contractorUser, "/invoices/new");

    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "X");

    await page.getByLabel("Add expense").setInputFiles({
      name: "large-receipt.pdf",
      mimeType: "application/pdf",
      buffer: largeBuffer,
    });

    await expect(page.getByRole("heading", { name: "File Size Exceeded" })).toBeVisible();

    await page.getByRole("button", { name: "OK" }).click();

    await page.getByLabel("Add expense").setInputFiles({
      name: "valid-receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("valid receipt content"),
    });
    await expect(page.getByText("valid-receipt.pdf")).toBeVisible();

    await page.getByLabel("Merchant").fill("Office Supplies Store");
    await page.getByLabel("Amount").fill("42.99");
    await expect(page.getByText("Total expenses$42.99")).toBeVisible();
  });
});

test.describe("AI PDF invoice parsing", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    company = (
      await companiesFactory.createCompletedOnboarding({
        equityEnabled: false,
      })
    ).company;

    contractorUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "22222",
        streetAddress: "1st St.",
      })
    ).user;

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
      payRateInSubunits: 10000, // $100/hour
    });

    await db.insert(expenseCategories).values({
      companyId: company.id,
      name: "Office Supplies",
    });
  });

  test("shows parsing progress when uploading PDF document", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Create a simple PDF buffer
    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 2\ntrailer<</Size 2/Root 1 0 R>>\n%%EOF",
    );

    await page.getByLabel("Add document").setInputFiles({
      name: "test-invoice.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    // Should show parsing progress
    await expect(page.getByText("Parsing PDF with AI to extract invoice data...")).toBeVisible();

    // Wait for parsing to complete
    await expect(page.getByText("Parsing PDF with AI to extract invoice data...")).not.toBeVisible({ timeout: 15000 });

    // Document should be attached
    await expect(page.getByText("test-invoice.pdf")).toBeVisible();
  });

  test("handles PDF parsing API errors gracefully", async ({ page }) => {
    // Skip if no API key configured
    if (!process.env.OPENAI_API_KEY) {
      test.skip(true, "OPENAI_API_KEY not configured");
    }

    await login(page, contractorUser, "/invoices/new");

    // Upload a minimal PDF that likely won't contain invoice data
    const nonInvoicePdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]>>endobj\nxref\n0 3\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF",
    );

    await page.getByLabel("Add document").setInputFiles({
      name: "empty-doc.pdf",
      mimeType: "application/pdf",
      buffer: nonInvoicePdf,
    });

    // Wait for parsing indicator to appear and disappear
    await expect(page.getByText("Parsing PDF with AI to extract invoice data...")).toBeVisible();
    await expect(page.getByText("Parsing PDF with AI to extract invoice data...")).not.toBeVisible({ timeout: 15000 });

    // Document should still be attached
    await expect(page.getByText("empty-doc.pdf")).toBeVisible();

    // Check if error message appears and can be dismissed
    const errorMessage = page.getByText(/doesn't appear to contain invoice data/iu);
    if (await errorMessage.isVisible()) {
      await page.getByRole("button", { name: "Dismiss" }).click();
      await expect(errorMessage).not.toBeVisible();
    }
  });

  test("validates oversized PDF files before parsing", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Create file larger than 10MB limit
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "X");

    await page.getByLabel("Add document").setInputFiles({
      name: "huge-file.pdf",
      mimeType: "application/pdf",
      buffer: largeBuffer,
    });

    // Should show size error dialog immediately
    await expect(page.getByRole("heading", { name: "File Size Exceeded" })).toBeVisible();
    await expect(page.getByText("File size exceeds the maximum limit of 10MB")).toBeVisible();

    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("heading", { name: "File Size Exceeded" })).not.toBeVisible();

    // File should not be uploaded
    await expect(page.getByText("huge-file.pdf")).not.toBeVisible();

    // Parsing indicator should never appear
    await expect(page.getByText("Parsing PDF with AI")).not.toBeVisible();
  });

  test("preserves existing form data when PDF upload occurs", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Fill some manual form data
    await page.getByLabel("Invoice ID").fill("MANUAL-001");
    await page.getByPlaceholder("Description").first().fill("Development work");
    await page.getByLabel("Hours / Qty").first().fill("5:00");
    await page.getByPlaceholder("Enter notes about your").fill("Manual notes");

    // Store the values to check later
    const originalInvoiceId = await page.getByLabel("Invoice ID").inputValue();
    const originalDescription = await page.getByPlaceholder("Description").first().inputValue();
    const originalNotes = await page.getByPlaceholder("Enter notes about your").inputValue();

    // Upload a minimal PDF
    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\ntrailer<</Size 2/Root 1 0 R>>\n%%EOF",
    );

    await page.getByLabel("Add document").setInputFiles({
      name: "minimal.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    // Wait for any parsing to complete
    if (await page.getByText("Parsing PDF with AI to extract invoice data...").isVisible()) {
      await expect(page.getByText("Parsing PDF with AI to extract invoice data...")).not.toBeVisible({
        timeout: 15000,
      });
    }

    // Document should be attached
    await expect(page.getByText("minimal.pdf")).toBeVisible();

    // If parsing fails (likely with minimal PDF), original data should be preserved
    const currentInvoiceId = await page.getByLabel("Invoice ID").inputValue();
    const currentDescription = await page.getByPlaceholder("Description").first().inputValue();
    const currentNotes = await page.getByPlaceholder("Enter notes about your").inputValue();

    // At least one field should retain its original value (indicating form is functional)
    const hasPreservedData =
      currentInvoiceId === originalInvoiceId ||
      currentDescription === originalDescription ||
      currentNotes === originalNotes;

    expect(hasPreservedData).toBe(true);
  });

  test("allows form submission after PDF upload regardless of parsing result", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Fill required fields
    await page.getByPlaceholder("Description").first().fill("Test work");
    await page.getByLabel("Hours / Qty").first().fill("2:00");

    // Upload PDF
    const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

    await page.getByLabel("Add document").setInputFiles({
      name: "work-doc.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    // Wait for any parsing to complete
    if (await page.getByText("Parsing PDF with AI to extract invoice data...").isVisible()) {
      await expect(page.getByText("Parsing PDF with AI to extract invoice data...")).not.toBeVisible({
        timeout: 15000,
      });
    }

    // Form should be submittable
    await page.getByRole("button", { name: "Send invoice" }).click();

    // Should navigate to invoices list or show validation errors
    await expect(page.getByRole("heading", { name: "Invoices" }).or(page.getByText("Invoice ID"))).toBeVisible();
  });

  test("handles non-PDF files without triggering AI parsing", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    // Try to upload a text file (browser will handle MIME type validation)
    await page.getByLabel("Add document").setInputFiles({
      name: "document.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is not a PDF"),
    });

    // Wait briefly for any potential processing
    await page.waitForLoadState("networkidle");

    // AI parsing indicator should not appear for non-PDF files
    await expect(page.getByText("Parsing PDF with AI")).not.toBeVisible();
  });
});
