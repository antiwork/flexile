import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { subDays } from "date-fns";
import { desc, eq } from "drizzle-orm";
import {
  companies,
  companyContractors,
  equityAllocations,
  expenseCategories,
  invoiceExpenses,
  invoices,
  users,
} from "@/db/schema";
import { fillDatePicker } from "@test/helpers";

test.describe("invoice creation", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;
  let companyContractor: typeof companyContractors.$inferSelect;

  test.beforeEach(async () => {
    company = (
      await companiesFactory.createCompletedOnboarding({
        equityCompensationEnabled: true,
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
      })
    ).companyContractor;
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 20,
      year: 2023,
    });
  });

  test("creates an invoice with an equity component", async ({ page }) => {
    await login(page, contractorUser);
    await page.goto("/invoices/new");

    await page.getByLabel("Hours").fill("3:25");
    await page.getByPlaceholder("Description").fill("I worked on invoices");
    await fillDatePicker(page, "Date", "08/08/2023");

    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).toHaveValue("20");
    await expect(
      page.getByText("By submitting this invoice, your current equity selection will be locked for all 2023."),
    ).toBeVisible();

    await expect(page.getByText("Total services$205")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$41")).toBeVisible();
    await expect(page.getByText("Net amount in cash$164")).toBeVisible();

    await page.getByRole("textbox", { name: "Cash vs equity split" }).fill("50");
    await expect(page.getByText("Total services$205")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$102.50")).toBeVisible();
    await expect(page.getByText("Net amount in cash$102.50")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.locator("tbody")).toContainText(
      ["Invoice ID", "1", "Sent on", "Aug 8, 2023", "Amount", "$205", "Status", "Awaiting approval (0/2)"].join(""),
    );

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice).toBeDefined();
    expect(invoice.totalAmountInUsdCents).toBe(20500n);
    expect(invoice.cashAmountInCents).toBe(10250n);
    expect(invoice.equityAmountInCents).toBe(10250n);
    expect(invoice.equityPercentage).toBe(50);

    const equityAllocation = await db.query.equityAllocations
      .findFirst({
        where: eq(equityAllocations.companyContractorId, companyContractor.id),
        orderBy: desc(equityAllocations.year),
      })
      .then(takeOrThrow);
    expect(equityAllocation.equityPercentage).toBe(50);
    expect(equityAllocation.locked).toBe(true);
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
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 20,
      year: 2021,
      locked: true,
    });

    await login(page, contractorUser);
    await page.goto("/invoices/new");

    await page.getByPlaceholder("Description").fill("I worked on invoices");
    await page.getByLabel("Hours").fill("03:25");
    await fillDatePicker(page, "Date", "08/08/2021");

    await expect(
      page.getByText("By submitting this invoice, your current equity selection will be locked for all 2021."),
    ).not.toBeVisible();

    await expect(page.getByText("Total$205")).toBeVisible();
    await expect(page.getByText("Swapped for equity")).not.toBeVisible();
    await expect(page.getByText("Net amount in cash")).not.toBeVisible();

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

    await login(page, contractorUser);
    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("item name");
    await page.getByLabel("Hours / Qty").fill("01:00");
    await page.getByPlaceholder("Enter notes about your").fill("sent as alumni");
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("cell", { name: "Awaiting approval (0/2)" })).toBeVisible();
  });

  test("does not show equity split if equity compensation is disabled", async ({ page }) => {
    await db.update(companies).set({ equityCompensationEnabled: false }).where(eq(companies.id, company.id));

    await login(page, contractorUser);
    await page.goto("/invoices/new");
    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).not.toBeVisible();
  });

  test("creates an invoice with only expenses, no line items", async ({ page }) => {
    await db.insert(expenseCategories).values({
      companyId: company.id,
      name: "Office Supplies",
    });
    await login(page, contractorUser);
    await page.goto("/invoices/new");

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
    await login(page, contractorUser);
    await page.goto("/invoices/new");

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
    await login(page, contractorUser);
    await page.goto("/invoices/new");

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
});
