import { companies, consolidatedInvoices, invoiceApprovals, invoices, users, companyContractors } from "@/db/schema";
import { assert } from "@/utils/assert";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { invoiceApprovalsFactory } from "@test/factories/invoiceApprovals";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { and, eq, exists, isNull, not } from "drizzle-orm";

const setupCompany = async ({ trusted = true }: { trusted?: boolean } = {}) => {
  const { company } = await companiesFactory.create({ isTrusted: trusted, requiredInvoiceApprovalCount: 2 });
  const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
  const user = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) });
  assert(user !== undefined);
  return { company, user };
};

test.describe("Invoices admin flow", () => {
  test("allows searching invoices by contractor name", async ({ page }) => {
    const { company, user: adminUser } = await setupCompany();

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "SearchTest Contractor",
    });
    const contractorUser = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractorUser !== undefined);

    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: companyContractor.id,
      totalAmountInUsdCents: BigInt(100_00),
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();

    const searchInput = page.getByPlaceholder("Search by Contractor...");
    await expect(searchInput).toBeVisible();

    await searchInput.fill(contractorUser.legalName || "");

    await expect(page.getByRole("row").filter({ hasText: contractorUser.legalName || "" })).toBeVisible();
  });

  test.describe("account statuses", () => {
    test("when payment method setup is incomplete, it shows the correct status message", async ({ page }) => {
      const { company, user } = await setupCompany();
      await companyStripeAccountsFactory.createProcessing({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);

      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByText("Bank account setup incomplete.")).toBeVisible();
    });

    test("when payment method setup is complete but company is not trusted and has invoices, shows the correct status message", async ({
      page,
    }) => {
      const { company, user } = await setupCompany({ trusted: false });
      await companyStripeAccountsFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);

      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByText("Payments to contractors may take up to 10 business days to process.")).toBeVisible();
    });

    test("when payment method setup is complete but company is not trusted and has no invoices, does not show the status message", async ({
      page,
    }) => {
      const { user } = await setupCompany({ trusted: false });
      await login(page, user);

      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByText("Bank account setup incomplete.")).not.toBeVisible();
      await expect(
        page.getByText("Payments to contractors may take up to 10 business days to process."),
      ).not.toBeVisible();
    });

    test("when payment method setup is complete and company is trusted, does not show the status message", async ({
      page,
    }) => {
      const { company, user } = await setupCompany({ trusted: true });
      await companyStripeAccountsFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });

      await login(page, user);

      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByText("Bank account setup incomplete.")).not.toBeVisible();
      await expect(
        page.getByText("Payments to contractors may take up to 10 business days to process."),
      ).not.toBeVisible();
    });

    test("loads successfully for alumni", async ({ page }) => {
      const { company } = await setupCompany();
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        endedAt: new Date("2023-01-01"),
      });
      const contractorUser = await db.query.users.findFirst({
        where: eq(users.id, companyContractor.userId),
      });
      assert(contractorUser !== undefined);

      await login(page, contractorUser);
      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByLabel("Hours / Qty")).toBeVisible();
      await expect(page.getByText("Total amount$60")).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: "New invoice" })).toBeVisible();
    });
  });

  const countInvoiceApprovals = async (companyId: bigint) =>
    await db.$count(
      invoiceApprovals,
      exists(
        db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, invoiceApprovals.invoiceId),
              eq(invoices.companyId, companyId),
              isNull(invoices.deletedAt),
            ),
          ),
      ),
    );

  test.describe("approving and paying invoices", () => {
    test("allows approving an invoice", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();
      const { invoice } = await invoicesFactory.create({ companyId: company.id });
      await login(page, adminUser);
      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.locator("tbody tr").first();
      await invoiceRow.getByRole("button", { name: "Approve" }).click();
      await expect(invoiceRow).toContainText("Approved!");
      await expect(page.getByRole("link", { name: "Invoices" }).getByRole("status")).not.toBeVisible();

      const updatedTargetInvoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, invoice.id),
        with: { approvals: true },
      });
      expect(updatedTargetInvoice?.status).toBe("approved");
      expect(updatedTargetInvoice?.approvals.length).toBe(1);
    });

    test("allows approving multiple invoices", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });
      await login(page, adminUser);
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.locator("th").getByLabel("Select all").check();
      await expect(page.getByText("2 selected")).toBeVisible();

      await page.locator("th").getByLabel("Select all").check();
      await page.getByRole("button", { name: "Approve selected" }).click();

      // TODO missing check - need to verify ChargeConsolidatedInvoiceJob not enqueued

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("$60")).toHaveCount(2);
          await modal.getByRole("button", { name: "Yes, proceed" }).click();
        },
        { page },
      );

      await expect(page.getByRole("dialog")).not.toBeVisible();
      expect(await countInvoiceApprovals(company.id)).toBe(2);

      const pendingInvoices = await db.$count(
        invoices,
        and(eq(invoices.companyId, company.id), not(eq(invoices.status, "approved"))),
      );
      expect(pendingInvoices).toBe(0);
    });

    test("allows approving an invoice that requires additional approvals", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();
      await db.update(companies).set({ requiredInvoiceApprovalCount: 3 }).where(eq(companies.id, company.id));
      const { invoice } = await invoicesFactory.create({ companyId: company.id, status: "approved" });
      await invoiceApprovalsFactory.create({ invoiceId: invoice.id });
      await login(page, adminUser);

      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = page.locator("tbody tr").first();
      await expect(invoiceRow).toContainText("Awaiting approval (1/3)");
      const invoiceApprovalsCountBefore = await countInvoiceApprovals(company.id);
      await invoiceRow.getByRole("button", { name: "Approve" }).click();
      await expect(invoiceRow.getByText("Approved!")).toBeVisible();

      expect(await countInvoiceApprovals(company.id)).toBe(invoiceApprovalsCountBefore + 1);

      const updatedInvoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, invoice.id),
      });
      expect(updatedInvoice?.status).toBe("approved");

      await page.waitForTimeout(1000);
      await expect(invoiceRow).toContainText("Awaiting approval (2/3)");
    });

    test.describe("with sufficient Flexile account balance", () => {
      test("allows approving invoices and paying invoices awaiting final approval immediately", async ({ page }) => {
        const { company, user: adminUser } = await setupCompany();
        await invoicesFactory.create({ companyId: company.id });
        await invoicesFactory.create({ companyId: company.id });
        const { invoice } = await invoicesFactory.create({
          companyId: company.id,
          totalAmountInUsdCents: 75_00n,
        });
        await invoiceApprovalsFactory.create({ invoiceId: invoice.id });
        await db.update(invoices).set({ status: "approved" }).where(eq(invoices.id, invoice.id));

        const { invoice: invoice2 } = await invoicesFactory.create({
          companyId: company.id,
          totalAmountInUsdCents: 75_00n,
        });
        await invoiceApprovalsFactory.create({ invoiceId: invoice2.id });
        await db.update(invoices).set({ status: "approved" }).where(eq(invoices.id, invoice2.id));

        await login(page, adminUser);
        await page.getByRole("link", { name: "Invoices" }).click();

        await page.locator("th").getByLabel("Select all").check();
        await expect(page.getByText("4 selected")).toBeVisible();
        await page.getByRole("button", { name: "Approve selected" }).click();

        const invoiceApprovalsCountBefore = await countInvoiceApprovals(company.id);
        const consolidatedInvoicesCountBefore = await db.$count(
          consolidatedInvoices,
          eq(consolidatedInvoices.companyId, company.id),
        );

        await withinModal(
          async (modal) => {
            await expect(modal.getByText("You are paying $150 now.")).toBeVisible();
            await expect(modal.getByText("$75")).toHaveCount(2);
            await expect(modal.getByText("$60")).toHaveCount(2);
            await modal.getByRole("button", { name: "Yes, proceed" }).click();
          },
          { page },
        );
        await expect(page.getByRole("dialog")).not.toBeVisible();

        const consolidatedInvoicesCountAfter = await db.$count(
          consolidatedInvoices,
          eq(consolidatedInvoices.companyId, company.id),
        );
        expect(await countInvoiceApprovals(company.id)).toBe(invoiceApprovalsCountBefore + 4);
        expect(consolidatedInvoicesCountAfter).toBe(consolidatedInvoicesCountBefore + 1);

        const updatedInvoices = await db.query.invoices.findMany({
          where: and(eq(invoices.companyId, company.id), isNull(invoices.deletedAt)),
        });
        const expectedPaidInvoices = [invoice.id, invoice2.id];
        for (const invoice of updatedInvoices) {
          expect(invoice.status).toBe(expectedPaidInvoices.includes(invoice.id) ? "payment_pending" : "approved");
        }
      });
    });
  });

  test.describe("rejecting invoices", () => {
    test("allows rejecting invoices without a reason", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });
      await login(page, adminUser);
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.locator("th").getByLabel("Select all").check();
      await expect(page.getByText("2 selected")).toBeVisible();
      await page.getByRole("button", { name: "Reject selected" }).click();

      await page.getByRole("button", { name: "Yes, reject" }).click();
      await page.getByRole("button", { name: "Filter" }).click();
      await page.getByRole("menuitem", { name: "Clear all filters" }).click();
      await expect(page.getByText("Rejected")).toHaveCount(2);

      const updatedInvoices = await db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });
      expect(updatedInvoices.length).toBe(2);
      expect(
        updatedInvoices.every((invoice) => invoice.status === "rejected" && invoice.rejectionReason === null),
      ).toBe(true);
    });

    test("allows rejecting invoices with a reason", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();
      await invoicesFactory.create({ companyId: company.id });
      await invoicesFactory.create({ companyId: company.id });
      await login(page, adminUser);
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.locator("th").getByLabel("Select all").check();
      await expect(page.getByText("2 selected")).toBeVisible();
      await page.getByRole("button", { name: "Reject selected" }).click();

      await page.getByLabel("Explain why the invoice").fill("Invoice issue date mismatch");
      await page.getByRole("button", { name: "Yes, reject" }).click();
      await page.getByRole("button", { name: "Filter" }).click();
      await page.getByRole("menuitem", { name: "Clear all filters" }).click();
      await expect(page.getByText("Rejected")).toHaveCount(2);

      const updatedInvoices = await db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });
      expect(updatedInvoices.length).toBe(2);
      expect(
        updatedInvoices.every(
          (invoice) => invoice.status === "rejected" && invoice.rejectionReason === "Invoice issue date mismatch",
        ),
      ).toBe(true);
    });
  });

  test("shows alert when viewing invoice with rates above default pay rate", async ({ page }) => {
    const { company, user: adminUser } = await setupCompany();
    const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });

    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: companyContractor.id,
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Invoices" }).click();
    await page.getByRole("row").getByText("Awaiting approval").first().click();

    await expect(page.getByText("This invoice includes rates above the default of $60/hour.")).toBeVisible();

    await db
      .update(companyContractors)
      .set({ payRateInSubunits: null })
      .where(eq(companyContractors.id, companyContractor.id));
    await page.reload();
    await page.getByRole("row").getByText("Awaiting approval").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("This invoice includes rates above the default of $60/hour.")).not.toBeVisible();

    await db
      .update(companyContractors)
      .set({ payRateInSubunits: 60000 })
      .where(eq(companyContractors.id, companyContractor.id));
    await page.reload();
    await page.getByRole("row").getByText("Awaiting approval").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("This invoice includes rates above the default of $60/hour.")).not.toBeVisible();
  });
});

test.describe("Invoices contractor flow", () => {
  const setupCompanyAndContractor = async () => {
    const { company, user: adminUser } = await setupCompany({ trusted: true });

    const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });

    const contractorUser = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractorUser !== undefined);

    return {
      company,
      adminUser,
      companyContractor: { ...companyContractor, user: contractorUser },
    };
  };

  test.describe("deleting invoices", () => {
    test("handles invoice deletion scenarios comprehensively", async ({ page }) => {
      const { company, companyContractor } = await setupCompanyAndContractor();

      await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: companyContractor.id,
        status: "received",
      });

      await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: companyContractor.id,
        status: "received",
      });

      const { invoice: paidInvoice } = await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: companyContractor.id,
        status: "received",
      });
      await db.update(invoices).set({ status: "paid" }).where(eq(invoices.id, paidInvoice.id));

      const contractorUser = companyContractor.user;
      await login(page, contractorUser);
      await page.getByRole("link", { name: "Invoices" }).click();

      assert(contractorUser.legalName !== null);

      const receivedInvoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await receivedInvoiceRow.click({ button: "right" });
      await expect(page.getByRole("menuitem").filter({ hasText: "Delete" })).toBeVisible();

      await page.click("body");

      const paidInvoiceRow = page.getByRole("row").getByText("Paid");
      await paidInvoiceRow.click({ button: "right" });
      await expect(page.getByRole("menuitem").filter({ hasText: "Delete" })).not.toBeVisible();

      await page.click("body");

      await expect(page.locator("tbody tr")).toHaveCount(3);

      const deletableInvoiceRow = page.getByRole("row").getByText("Awaiting approval").first();
      await deletableInvoiceRow.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Delete" }).click();

      await expect(page.locator("tbody tr")).toHaveCount(2);

      const remainingInvoices = await db.query.invoices.findMany({
        where: and(eq(invoices.companyId, company.id), isNull(invoices.deletedAt)),
      });
      expect(remainingInvoices.length).toBe(2);
    });
  });
});
