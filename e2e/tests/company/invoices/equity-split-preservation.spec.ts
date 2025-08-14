import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { companies, companyContractors, invoices } from "@/db/schema";

type User = Awaited<ReturnType<typeof usersFactory.create>>["user"];
type Company = Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>;

test.describe("Equity Split Preservation - E2E", () => {
  let company: Company;
  let adminUser: User;
  let contractorUser: User;
  let contractorWithEquity: Awaited<ReturnType<typeof companyContractorsFactory.create>>["companyContractor"];

  test.beforeEach(async () => {
    company = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "10.00",
      requiredInvoiceApprovalCount: 1,
    });

    adminUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });

    contractorUser = (await usersFactory.create()).user;
    contractorWithEquity = (
      await companyContractorsFactory.create({
        companyId: company.company.id,
        userId: contractorUser.id,
        equityPercentage: 20,
        payRateInSubunits: 5000,
      })
    ).companyContractor;
  });

  test("complete user flow: invoice succeeds without grant → admin creates grant → approval succeeds", async ({
    page,
  }) => {
    await login(page, contractorUser);
    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Development work");
    await page.getByLabel("Hours").fill("10:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await expect(page.getByText("Total services$500")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$0")).toBeVisible();
    await expect(page.getByText("Net amount in cash$500")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("$500");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await logout(page);

    await login(page, adminUser);

    const companyInvestor = (
      await companyInvestorsFactory.create({
        userId: contractorUser.id,
        companyId: company.company.id,
      })
    ).companyInvestor;

    await equityGrantsFactory.createActive(
      {
        companyInvestorId: companyInvestor.id,
        sharePriceUsd: "10.00",
        unvestedShares: 100,
      },
      { year: 2024 },
    );

    await logout(page);

    await page.goto("/invoices");

    const firstInvoiceRow = page.locator("tbody tr").first();
    await expect(firstInvoiceRow).toContainText("$500");
    await firstInvoiceRow.getByRole("button", { name: "Pay now" }).click();

    await expect(page.getByText("Admin must create an equity grant")).toBeVisible();

    await logout(page);

    await login(page, contractorUser);
    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Development work with grant");
    await page.getByLabel("Hours").fill("10:00");
    await fillDatePicker(page, "Date", "12/16/2024");

    await expect(page.getByText("Total services$500")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$100")).toBeVisible();
    await expect(page.getByText("Net amount in cash$400")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const newInvoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    expect(newInvoice.totalAmountInUsdCents).toBe(50000n);
    expect(newInvoice.equityAmountInCents).toBe(10000n);
    expect(newInvoice.cashAmountInCents).toBe(40000n);
    expect(newInvoice.equityPercentage).toBe(20);

    await logout(page);

    await login(page, adminUser);
    await page.goto("/invoices");

    const newInvoiceRow = page.locator("tbody tr").first();
    await expect(newInvoiceRow).toContainText("$500");
    await newInvoiceRow.getByRole("button", { name: "Pay now" }).click();

    await expect(newInvoiceRow).toContainText("Payment scheduled");
  });

  test("approval flow: insufficient grant → admin creates sufficient grant → approval succeeds", async ({ page }) => {
    const companyInvestor = (
      await companyInvestorsFactory.create({
        userId: contractorUser.id,
        companyId: company.company.id,
      })
    ).companyInvestor;

    await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      numberOfShares: 10,
      unvestedShares: 5,
      vestedShares: 5,
      sharePriceUsd: "10.00",
      periodEndedAt: new Date(`${new Date().getFullYear()}-12-31`),
    });

    await login(page, contractorUser);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Large development project");
    await page.getByLabel("Hours").fill("100:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await expect(page.getByText("Total services$5,000")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$0")).toBeVisible();
    await expect(page.getByText("Net amount in cash$5,000")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("$5,000");

    await logout(page);
    await login(page, adminUser);

    await equityGrantsFactory.createActive(
      {
        companyInvestorId: companyInvestor.id,
        sharePriceUsd: "10.00",
        unvestedShares: 200,
      },
      { year: 2024 },
    );

    await logout(page);
    await login(page, contractorUser);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Large development project");
    await page.getByLabel("Hours").fill("100:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await expect(page.getByText("Total services$5,000")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$1,000")).toBeVisible();
    await expect(page.getByText("Net amount in cash$4,000")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("$5,000");

    await logout(page);
    await login(page, adminUser);

    await page.goto("/invoices");
    const invoiceRow = page.locator("tbody tr").first();
    await expect(invoiceRow).toContainText("$5,000");
    await invoiceRow.getByRole("button", { name: "Pay now" }).click();

    await expect(invoiceRow).toContainText("Payment scheduled");
  });

  test("zero equity percentage works without grants", async ({ page }) => {
    const zeroEquityUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: zeroEquityUser.id,
      equityPercentage: 0,
      payRateInSubunits: 5000,
    });

    await login(page, zeroEquityUser);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Regular work");
    await page.getByLabel("Hours").fill("8:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await expect(page.getByText("Total services$400")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$0")).toBeVisible();
    await expect(page.getByText("Net amount in cash$400")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("$400");

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    expect(invoice.totalAmountInUsdCents).toBe(40000n);
    expect(invoice.equityAmountInCents).toBe(0n);
    expect(invoice.cashAmountInCents).toBe(40000n);
    expect(invoice.equityPercentage).toBe(0);

    await logout(page);
    await login(page, adminUser);

    await page.goto("/invoices");
    const invoiceRow = page.locator("tbody tr").first();
    await expect(invoiceRow).toContainText("$400");
    await invoiceRow.getByRole("button", { name: "Pay now" }).click();

    await expect(invoiceRow).toContainText("Payment scheduled");
  });

  test("equity disabled company bypasses all validation", async ({ page }) => {
    await db.update(companies).set({ equityEnabled: false }).where(eq(companies.id, company.company.id));

    await login(page, contractorUser);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Work with equity disabled");
    await page.getByLabel("Hours").fill("10:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await expect(page.getByText("Total services$500")).toBeVisible();
    await expect(page.getByText("Swapped for equity")).not.toBeVisible();
    await expect(page.getByText("Net amount in cash")).not.toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("$500");

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    expect(invoice.totalAmountInUsdCents).toBe(50000n);
    expect(invoice.equityAmountInCents).toBe(0n);
    expect(invoice.cashAmountInCents).toBe(50000n);
    expect(invoice.equityPercentage).toBe(20);

    await logout(page);
    await login(page, adminUser);

    await page.goto("/invoices");
    const invoiceRow = page.locator("tbody tr").first();
    await expect(invoiceRow).toContainText("$500");
    await invoiceRow.getByRole("button", { name: "Pay now" }).click();

    await expect(invoiceRow).toContainText("Payment scheduled");
  });

  test("equity percentage is preserved when invoice creation fails", async ({ page }) => {
    await login(page, contractorUser);

    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Test work");
    await page.getByLabel("Hours").fill("5:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await page.getByRole("link", { name: "Invoices" }).click();
    await page.locator("header").getByRole("link", { name: "New invoice" }).click();

    await page.getByPlaceholder("Description").fill("Another test");
    await page.getByLabel("Hours").fill("3:00");
    await fillDatePicker(page, "Date", "12/16/2024");

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const updatedContractor = await db.query.companyContractors
      .findFirst({ where: eq(companyContractors.id, contractorWithEquity.id) })
      .then(takeOrThrow);

    expect(updatedContractor.equityPercentage).toBe(20);
  });

  test("bulk approval fails when some invoices need equity grants", async ({ page }) => {
    const zeroEquityUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: zeroEquityUser.id,
      equityPercentage: 0,
      payRateInSubunits: 5000,
    });

    await login(page, zeroEquityUser);
    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Zero equity work");
    await page.getByLabel("Hours").fill("5:00");
    await fillDatePicker(page, "Date", "12/15/2024");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await db.insert(invoices).values({
      companyId: company.company.id,
      companyContractorId: contractorWithEquity.id,
      userId: contractorUser.id,
      createdById: contractorUser.id,
      totalAmountInUsdCents: 30000n,
      cashAmountInCents: 30000n,
      equityAmountInCents: 0n,
      equityAmountInOptions: 0,
      equityPercentage: 20,
      invoiceDate: "2024-12-16",
      dueOn: "2024-12-16",
      billFrom: contractorUser.legalName || "Test User",
      billTo: company.company.name || "Test Company",
      status: "received",
      invoiceNumber: "2",
    });

    await logout(page);
    await login(page, adminUser);

    await page.goto("/invoices");

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await page.getByRole("button", { name: "Approve selected invoices" }).click();

    await expect(page.getByText("Admin must create an equity grant")).toBeVisible();
  });

  test("shows consistent error messages between frontend and backend", async ({ page }) => {
    await login(page, contractorUser);
    await page.locator("header").getByRole("link", { name: "New invoice" }).click();
    await page.getByPlaceholder("Description").fill("Consistency test");
    await page.getByLabel("Hours").fill("10:00");
    await fillDatePicker(page, "Date", "12/15/2024");

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Please contact the company administrator")).not.toBeVisible();
  });
});
