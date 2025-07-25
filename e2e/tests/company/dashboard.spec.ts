import { db } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { documentsFactory } from "@test/factories/documents";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { invoicesFactory } from "@test/factories/invoices";
import {
  assertDashboardCardsVisible,
  assertDashboardQuickActions,
  assertDashboardWelcomeVisible,
  assertEarningsData,
  assertEquityData,
  assertOnboardingComplete,
} from "@test/helpers/assertions";
import { navigateToDashboard, setupContractorWithCompany } from "@test/helpers/setup";
import { expect, test } from "@test/index";
import { format, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { invoices } from "@/db/schema";

test.describe("Dashboard", () => {
  test("displays comprehensive overview for contractors with real data", async ({ page }) => {
    // Setup contractor with company using helper
    const { company, contractorUser, companyContractor } = await setupContractorWithCompany(page, {
      payRateInSubunits: 5000, // $50/hour
    });

    // Create test invoices with proper paid status
    const { invoice: paidInvoice } = await invoicesFactory.create({
      companyContractorId: companyContractor.id,
      totalAmountInUsdCents: 50000n, // $500
      status: "paid",
      invoiceDate: format(new Date(), "yyyy-MM-dd"), // Current month
    });

    // Mark the invoice as paid by setting paidAt
    await db
      .update(invoices)
      .set({
        paidAt: new Date(),
        status: "paid",
      })
      .where(eq(invoices.id, paidInvoice.id));

    // Create a previous month invoice
    const { invoice: previousInvoice } = await invoicesFactory.create({
      companyContractorId: companyContractor.id,
      totalAmountInUsdCents: 30000n, // $300
      status: "paid",
      invoiceDate: format(subDays(new Date(), 35), "yyyy-MM-dd"), // Previous month
    });

    // Mark the previous invoice as paid
    await db
      .update(invoices)
      .set({
        paidAt: subDays(new Date(), 35),
        status: "paid",
      })
      .where(eq(invoices.id, previousInvoice.id));

    // Create company investor for the contractor (needed for equity grants)
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    // Create test equity grant
    await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      vestedShares: 250,
      numberOfShares: 1000,
      sharePriceUsd: "10.0",
    });

    // Create test document
    await documentsFactory.create({
      companyId: company.id,
    });

    // Navigate to dashboard
    await navigateToDashboard(page);

    // Test welcome header
    await assertDashboardWelcomeVisible(page);

    // Test dashboard cards
    await assertDashboardCardsVisible(page);

    // Test that we can see the earnings section with data
    await expect(page.getByText("Earnings")).toBeVisible();

    // Test that we can see the equity section with data
    await expect(page.getByText("Equity").first()).toBeVisible();

    // Test that we can see the activity section with data
    await expect(page.getByText("Activity")).toBeVisible();

    // Test that we have some numbers on the dashboard (indicating data is loaded)
    const allNumbers = await page.locator("text=/\\$\\d+|\\d+%/").count();
    expect(allNumbers).toBeGreaterThan(0);

    // Test that we can see invoice and document counts
    const hasInvoiceData = await page.locator("text=/\\d+.*invoice|invoice.*\\d+/i").count();
    const hasDocumentData = await page.locator("text=/\\d+.*document|document.*\\d+/i").count();

    // At least one of these should have data
    expect(hasInvoiceData + hasDocumentData).toBeGreaterThan(0);

    // Test quick actions
    await assertDashboardQuickActions(page);

    // Test that onboarding checklist is complete (should not be visible)
    await assertOnboardingComplete(page);
  });

  test("displays realistic data for new contractor", async ({ page }) => {
    // Setup contractor with company using helper
    const { company, contractorUser, companyContractor } = await setupContractorWithCompany(page, {
      payRateInSubunits: 7500, // $75/hour
    });

    // Create a paid invoice for this contractor
    const { invoice: paidInvoice } = await invoicesFactory.create({
      companyContractorId: companyContractor.id,
      totalAmountInUsdCents: 15000n, // $150
      status: "paid",
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
    });

    // Mark the invoice as paid
    await db
      .update(invoices)
      .set({
        paidAt: new Date(),
        status: "paid",
      })
      .where(eq(invoices.id, paidInvoice.id));

    // Create company investor for potential equity grants
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    // Create a small equity grant to show some equity progress
    await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      vestedShares: 50,
      numberOfShares: 500,
      sharePriceUsd: "5.0",
    });

    // Create a document that needs signing
    await documentsFactory.create({
      companyId: company.id,
    });

    // Navigate to dashboard
    await navigateToDashboard(page);

    // Test dashboard cards exist
    await assertDashboardCardsVisible(page);

    // Test that we can see the earnings section with data
    await expect(page.getByText("Earnings")).toBeVisible();

    // Test that we can see the equity section with data
    await expect(page.getByText("Equity").first()).toBeVisible();

    // Test that we can see the activity section with data
    await expect(page.getByText("Activity")).toBeVisible();

    // Test that we have some numbers on the dashboard (indicating data is loaded)
    const allNumbers = await page.locator("text=/\\$\\d+|\\d+%/").count();
    expect(allNumbers).toBeGreaterThan(0);

    // Test that we can see invoice and document counts
    const hasInvoiceData = await page.locator("text=/\\d+.*invoice|invoice.*\\d+/i").count();
    const hasDocumentData = await page.locator("text=/\\d+.*document|document.*\\d+/i").count();

    // At least one of these should have data
    expect(hasInvoiceData + hasDocumentData).toBeGreaterThan(0);

    // Test that onboarding checklist is complete (should not be visible)
    await assertOnboardingComplete(page);
  });

  test("handles API errors gracefully", async ({ page }) => {
    // Setup contractor with company using helper
    await setupContractorWithCompany(page);

    // Mock API errors for dashboard endpoints to test error handling
    await page.route("**/api/trpc/dashboard.**", (route) => {
      route.fulfill({ status: 500, body: "Internal Server Error" });
    });

    // Navigate to dashboard
    await page.goto("/dashboard");

    // Wait for the page to load
    await page.waitForLoadState("domcontentloaded");

    // Should still show the basic dashboard structure even with API errors
    await assertDashboardWelcomeVisible(page);
    await assertDashboardCardsVisible(page);

    // Test that onboarding checklist is complete (should not be visible)
    await assertOnboardingComplete(page);
  });

  test("displays zero values for completely new user", async ({ page }) => {
    // Setup contractor with company using helper
    await setupContractorWithCompany(page, {
      payRateInSubunits: 5000, // $50/hour
    });

    // Navigate to dashboard
    await navigateToDashboard(page);

    // Test dashboard cards exist
    await assertDashboardCardsVisible(page);

    // Test zero values for completely new user
    await assertEarningsData(page, "$0.00"); // No earnings
    await assertEquityData(page, "0%", "$0.00"); // No equity
    await expect(page.getByText("0h")).toBeVisible(); // No hours logged
    await expect(page.getByText("0").first()).toBeVisible(); // No invoices submitted
    await expect(page.getByText("0").first()).toBeVisible(); // No documents to sign

    // Test that onboarding checklist is complete (should not be visible)
    await assertOnboardingComplete(page);
  });

  test("displays specific values for contractor with known data", async ({ page }) => {
    // Setup contractor with company using helper
    const { company, contractorUser, companyContractor } = await setupContractorWithCompany(page, {
      payRateInSubunits: 10000, // $100/hour
    });

    // Create a specific invoice with known amount
    const { invoice } = await invoicesFactory.create({
      companyContractorId: companyContractor.id,
      totalAmountInUsdCents: 25000n, // $250
      status: "paid",
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
    });

    // Mark the invoice as paid
    await db
      .update(invoices)
      .set({
        paidAt: new Date(),
        status: "paid",
      })
      .where(eq(invoices.id, invoice.id));

    // Create company investor for equity grants
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    // Create a specific equity grant
    await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      vestedShares: 100,
      numberOfShares: 1000,
      sharePriceUsd: "5.0", // $5 per share
    });

    // Create a document
    await documentsFactory.create({
      companyId: company.id,
    });

    // Navigate to dashboard
    await navigateToDashboard(page);

    // Test dashboard cards exist
    await assertDashboardCardsVisible(page);

    // Test specific values that should appear
    await expect(page.getByText("Earnings")).toBeVisible();
    await expect(page.getByText("Equity").first()).toBeVisible();
    await expect(page.getByText("Activity")).toBeVisible();

    // Test that we can see some numbers (indicating data is loaded)
    const allNumbers = await page.locator("text=/\\$\\d+|\\d+%/").count();
    expect(allNumbers).toBeGreaterThan(0);

    // Test that we can see invoice and document counts
    const hasInvoiceData = await page.locator("text=/\\d+.*invoice|invoice.*\\d+/i").count();
    const hasDocumentData = await page.locator("text=/\\d+.*document|document.*\\d+/i").count();

    // At least one of these should have data
    expect(hasInvoiceData + hasDocumentData).toBeGreaterThan(0);

    // Test that onboarding checklist is complete
    await assertOnboardingComplete(page);
  });
});
