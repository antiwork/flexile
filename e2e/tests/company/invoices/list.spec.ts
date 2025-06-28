import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { invoiceApprovalsFactory } from "@test/factories/invoiceApprovals";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { format } from "date-fns";
import { and, eq, not } from "drizzle-orm";
import { companies, consolidatedInvoices, invoiceApprovals, invoices, users } from "@/db/schema";
import { assert } from "@/utils/assert";

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
  const setupCompany = async ({ trusted = true }: { trusted?: boolean } = {}) => {
    const { company } = await companiesFactory.create({ isTrusted: trusted, requiredInvoiceApprovalCount: 2 });
    const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
    const user = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) });
    assert(user !== undefined);
    return { company, user };
  };

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

  const countInvoiceApprovals = (companyId: bigint) =>
    db.$count(
      db
        .select()
        .from(invoiceApprovals)
        .innerJoin(invoices, eq(invoiceApprovals.invoiceId, invoices.id))
        .where(eq(invoices.companyId, companyId)),
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
      const approvalButton = invoiceRow.getByText("Awaiting approval (1/2)");
      await expect(page.getByRole("link", { name: "Invoices" }).getByRole("status")).not.toBeVisible();

      const updatedTargetInvoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, invoice.id),
        with: { approvals: true },
      });
      expect(updatedTargetInvoice?.status).toBe("approved");
      expect(updatedTargetInvoice?.approvals.length).toBe(1);

      const approvedTime = updatedTargetInvoice?.approvals[0]?.approvedAt;
      assert(approvedTime !== undefined);
      await expect(approvalButton).toHaveTooltip(`Approved by you on ${format(approvedTime, "MMM d, yyyy, h:mm a")}`);
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
          totalAmountInUsdCents: BigInt(7500),
        });
        await invoiceApprovalsFactory.create({ invoiceId: invoice.id });
        await db.update(invoices).set({ status: "approved" }).where(eq(invoices.id, invoice.id));

        const { invoice: invoice2 } = await invoicesFactory.create({
          companyId: company.id,
          totalAmountInUsdCents: BigInt(7500),
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

        const updatedInvoices = await db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });
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

      await page
        .getByLabel("Explain why the invoice was rejected and how to fix it (optional)")
        .fill("Invoice issue date mismatch");
      await page.getByRole("button", { name: "Yes, reject" }).click();
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

  test.describe("invoice filtering functionality", () => {
    test("shows default filtered invoices (received, approved, payment_pending, rejected) by default", async ({ page }) => {
      const { company, user } = await setupCompany();
      
      await invoicesFactory.create({ companyId: company.id, status: "received" });
      await invoicesFactory.create({ companyId: company.id, status: "approved" });
      await invoicesFactory.create({ companyId: company.id, status: "payment_pending" });
      await invoicesFactory.create({ companyId: company.id, status: "rejected" });
      await invoicesFactory.create({ companyId: company.id, status: "paid" });
      await invoicesFactory.create({ companyId: company.id, status: "failed" });
      
      await login(page, user);
      
      await expect(page.locator("tbody tr")).toHaveCount(4);
      await expect(page.getByText("Awaiting approval").first()).toBeVisible();
      await expect(page.getByText("Payment scheduled")).toBeVisible();
      await expect(page.getByText("Rejected")).toBeVisible();
      
      await expect(page.getByText("Paid")).not.toBeVisible();
      await expect(page.getByText("Failed")).not.toBeVisible();
    });

    test("toggle button switches between filtered and all invoices", async ({ page }) => {
      const { company, user } = await setupCompany();
      
      await invoicesFactory.create({ companyId: company.id, status: "received" });
      await invoicesFactory.create({ companyId: company.id, status: "paid" });
      await invoicesFactory.create({ companyId: company.id, status: "failed" });
      
      await login(page, user);
      
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Show all invoices" })).toBeVisible();
      
      await page.getByRole("button", { name: "Show all invoices" }).click();
      
      await expect(page.locator("tbody tr")).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Show pending invoices only" })).toBeVisible();
      await expect(page.getByText("Paid")).toBeVisible();
      await expect(page.getByText("Failed")).toBeVisible();
      
      await page.getByRole("button", { name: "Show pending invoices only" }).click();
      
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Show all invoices" })).toBeVisible();
    });

    test("localStorage persists filter preferences across page refreshes", async ({ page }) => {
      const { company, user } = await setupCompany();
      
      await invoicesFactory.create({ companyId: company.id, status: "received" });
      await invoicesFactory.create({ companyId: company.id, status: "paid" });
      
      await login(page, user);
      
      await expect(page.getByRole("button", { name: "Show all invoices" })).toBeVisible();
      
      await page.getByRole("button", { name: "Show all invoices" }).click();
      await expect(page.locator("tbody tr")).toHaveCount(2);
      
      const storedFilter = await page.evaluate(() => {
        const stored = localStorage.getItem("invoicesStatusFilter") ?? "{}";
        try {
          const parsed = JSON.parse(stored) as Record<string, unknown>;
          return parsed && typeof parsed === 'object' && Array.isArray(parsed.status) ? { status: parsed.status as string[] } : null;
        } catch {
          return null;
        }
      });
      expect(storedFilter).toEqual({ status: [] });
      
      await page.reload();
      
      await expect(page.locator("tbody tr")).toHaveCount(2);
      await expect(page.getByRole("button", { name: "Show pending invoices only" })).toBeVisible();
      
      await page.getByRole("button", { name: "Show pending invoices only" }).click();
      
      const newStoredFilter = await page.evaluate(() => {
        const stored = localStorage.getItem("invoicesStatusFilter") ?? "{}";
        try {
          const parsed = JSON.parse(stored) as Record<string, unknown>;
          return parsed && typeof parsed === 'object' && Array.isArray(parsed.status) ? { status: parsed.status as string[] } : null;
        } catch {
          return null;
        }
      });
      expect(newStoredFilter?.status).toEqual([]);
      
      await page.reload();
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Show all invoices" })).toBeVisible();
    });

    test("toggle button only visible for administrators", async ({ page }) => {
      const contractorUser = (await usersFactory.create()).user;
      const { company: contractorCompany } = await companiesFactory.create();
      await companyContractorsFactory.create({
        companyId: contractorCompany.id,
        userId: contractorUser.id,
      });
      
      await invoicesFactory.create({ companyId: contractorCompany.id, userId: contractorUser.id });
      
      await login(page, contractorUser);
      
      await expect(page.getByRole("button", { name: "Show all invoices" })).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Show pending invoices only" })).not.toBeVisible();
    });
  });
});
