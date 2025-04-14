import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyContractorUpdatesFactory } from "@test/factories/companyContractorUpdates";
import {
  companyContractorUpdateTasksFactory,
  githubIntegrationRecordForTaskFactory,
} from "@test/factories/companyContractorUpdateTasks";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { invoiceApprovalsFactory } from "@test/factories/invoiceApprovals";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { findRequiredTableRow, findTableRow } from "@test/helpers/matchers";
import { expect, test } from "@test/index";
import { format } from "date-fns";
import { and, eq, not } from "drizzle-orm";
import { companies, companyRoles, consolidatedInvoices, invoiceApprovals, invoices, users } from "@/db/schema";
import { assert } from "@/utils/assert";

type Company = Awaited<ReturnType<typeof companiesFactory.create>>["company"];
type User = Awaited<ReturnType<typeof usersFactory.create>>["user"];
type CompanyContractor = Awaited<ReturnType<typeof companyContractorsFactory.create>>["companyContractor"];
type CompanyContractorWithRoleAndUser = CompanyContractor & {
  companyRole: typeof companyRoles.$inferSelect;
  user: User;
};
type Invoice = Awaited<ReturnType<typeof invoicesFactory.create>>["invoice"];
test.describe("Invoices admin flow", () => {
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
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("Create a new invoice to get started.")).toBeVisible();
    });
  });

  const sharedInvoiceTests = (
    testContext = test,
    setup: () => Promise<{
      company: Company;
      adminUser: User;
      companyContractor: CompanyContractorWithRoleAndUser;
      totalMinutes: number | null;
      expectedHours: string;
    }>,
  ) => {
    let company: Company;
    let adminUser: User;
    let companyContractor: CompanyContractorWithRoleAndUser;
    let totalMinutes: number | null;
    let expectedHours: string;
    let targetInvoice: Invoice;

    const getInvoices = () => db.query.invoices.findMany({ where: eq(invoices.companyId, company.id) });

    const countInvoiceApprovals = () =>
      db.$count(
        db
          .select()
          .from(invoiceApprovals)
          .innerJoin(invoices, eq(invoiceApprovals.invoiceId, invoices.id))
          .where(eq(invoices.companyId, company.id)),
      );

    let targetInvoiceRowSelector: Record<string, string>;
    let anotherInvoiceRowSelector: Record<string, string>;
    testContext.describe("shared invoices tests", () => {
      testContext.beforeEach(async () => {
        ({ company, adminUser, companyContractor, totalMinutes, expectedHours } = await setup());

        ({ invoice: targetInvoice } = await invoicesFactory.create({
          companyId: company.id,
          companyContractorId: companyContractor.id,
          totalAmountInUsdCents: BigInt(60_00),
          totalMinutes,
        }));

        assert(companyContractor.user.legalName !== null);

        targetInvoiceRowSelector = {
          Contractor: companyContractor.user.legalName,
          "Sent on": format(targetInvoice.invoiceDate, "MMM d, yyyy"),
          Hours: expectedHours,
          Amount: "$60",
        };
      });

      testContext.describe("approving and paying invoices", () => {
        testContext.beforeEach(async () => {
          const { invoice: anotherInvoice } = await invoicesFactory.create({
            companyId: company.id,
            totalAmountInUsdCents: BigInt(75_00),
            totalMinutes: 120,
          });
          const anotherInvoiceUser = await db.query.users.findFirst({
            where: eq(users.id, anotherInvoice.userId),
          });
          assert(anotherInvoiceUser !== undefined);
          assert(anotherInvoiceUser.legalName !== null);
          anotherInvoiceRowSelector = {
            Contractor: anotherInvoiceUser.legalName,
            "Sent on": format(targetInvoice.invoiceDate, "MMM d, yyyy"),
            Hours: "02:00",
            Amount: "$75",
          };
        });

        testContext("allows approving an invoice", async ({ page }) => {
          await login(page, adminUser);
          await page.getByRole("link", { name: "Invoices" }).click();

          let targetInvoiceRow = await findRequiredTableRow(page, targetInvoiceRowSelector);

          await expect(targetInvoiceRow.getByText(companyContractor.companyRole.name)).toBeVisible();
          await targetInvoiceRow.getByRole("button", { name: "Approve" }).click();
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(300);
          // await expect(targetInvoiceRow.getByText("Approved!")).toBeVisible(); // TODO (dani) fix
          expect(await findTableRow(page, targetInvoiceRowSelector)).toBeNull();

          const anotherInvoiceRow = await findRequiredTableRow(page, anotherInvoiceRowSelector);
          await expect(anotherInvoiceRow.getByText("Approved!")).not.toBeVisible();

          const updatedTargetInvoice = await db.query.invoices.findFirst({
            where: eq(invoices.id, targetInvoice.id),
            with: {
              approvals: true,
            },
          });
          expect(updatedTargetInvoice?.status).toBe("approved");
          expect(updatedTargetInvoice?.approvals.length).toBe(1);

          await page.getByRole("tab", { name: "History" }).click();
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(300);
          targetInvoiceRow = await findRequiredTableRow(page, targetInvoiceRowSelector);
          await expect(targetInvoiceRow.getByText(companyContractor.companyRole.name)).toBeVisible();
          const approvalButton = targetInvoiceRow.getByText("Awaiting approval (1/2)");
          const approvedTime = updatedTargetInvoice?.approvals[0]?.approvedAt;
          assert(approvedTime !== undefined);
          await expect(approvalButton).toHaveTooltip(
            `Approved by you on ${format(approvedTime, "MMM d, yyyy, h:mm a")}`,
          );
        });

        testContext("allows approving multiple invoices", async ({ page }) => {
          await login(page, adminUser);
          await page.getByRole("link", { name: "Invoices" }).click();

          await page.locator("th").getByLabel("Select all").check();
          await expect(page.getByText("2 selected")).toBeVisible();

          await page.locator("th").getByLabel("Select all").check();
          await page.getByRole("button", { name: "Approve selected" }).click();
          await page.waitForLoadState("networkidle");

          const consolidatedInvoiceCount = await db.$count(
            db.select().from(consolidatedInvoices).where(eq(consolidatedInvoices.companyId, company.id)),
          );
          expect(consolidatedInvoiceCount).toBe(0);
          // TODO missing check - need to verify ChargeConsolidatedInvoiceJob not enqueued

          const modal = page.getByRole("dialog");
          await expect(modal.getByText("$60")).toHaveCount(1);
          await expect(modal.getByText("$75")).toHaveCount(1);
          await modal.getByRole("button", { name: "Yes, proceed" }).click();

          await expect(page.getByText("No invoices to display.")).toBeVisible();
          expect(await countInvoiceApprovals()).toBe(2);

          await expect(page.getByText("No invoices to display.")).toBeVisible();
          const pendingInvoices = await db.$count(
            invoices,
            and(eq(invoices.companyId, company.id), not(eq(invoices.status, "approved"))),
          );
          expect(pendingInvoices).toBe(0);
        });

        testContext("allows approving an invoice that requires additional approvals", async ({ page }) => {
          await db.update(companies).set({ requiredInvoiceApprovalCount: 3 }).where(eq(companies.id, company.id));
          await db.update(invoices).set({ status: "approved" }).where(eq(invoices.id, targetInvoice.id));
          await invoiceApprovalsFactory.create({ invoiceId: targetInvoice.id });

          await login(page, adminUser);
          await page.getByRole("link", { name: "Invoices" }).click();

          const rowSelector = {
            ...targetInvoiceRowSelector,
            Status: "Awaiting approval (1/3)",
          };
          const invoiceRow = await findRequiredTableRow(page, rowSelector);
          await expect(invoiceRow.getByText(companyContractor.companyRole.name)).toBeVisible();

          const invoiceApprovalsCountBefore = await countInvoiceApprovals();
          await invoiceRow.getByRole("button", { name: "Approve" }).click();
          assert(companyContractor.user.legalName !== null);
          await expect(page.getByText(companyContractor.user.legalName)).not.toBeVisible();

          // await expect(invoiceRow.getByText("Approved!")).toBeVisible(); // TODO (dani) fix

          expect(await countInvoiceApprovals()).toBe(invoiceApprovalsCountBefore + 1);

          expect(await findTableRow(page, rowSelector)).toBeNull();

          const anotherInvoiceRow = await findRequiredTableRow(page, anotherInvoiceRowSelector);
          await expect(anotherInvoiceRow.getByText("Approved!")).not.toBeVisible();

          const updatedInvoice = await db.query.invoices.findFirst({
            where: eq(invoices.id, targetInvoice.id),
          });
          expect(updatedInvoice?.status).toBe("approved");

          await page.getByRole("tab", { name: "History" }).click();

          const approvedInvoiceSelector = {
            ...targetInvoiceRowSelector,
            Status: "Awaiting approval (2/3)",
          };
          await expect(page.getByText(companyContractor.user.legalName)).toBeVisible();
          const approvedInvoiceRow = await findRequiredTableRow(page, approvedInvoiceSelector);
          await expect(approvedInvoiceRow.getByText(companyContractor.companyRole.name)).toBeVisible();
        });

        testContext.describe("with sufficient Flexile account balance", () => {
          testContext(
            "allows approving invoices and paying invoices awaiting final approval immediately",
            async ({ page }) => {
              const { user: anotherAdminUser } = await usersFactory.create();
              await companyAdministratorsFactory.create({
                companyId: company.id,
                userId: anotherAdminUser.id,
              });
              const { invoice: invoice3 } = await invoicesFactory.create({
                companyId: company.id,
                companyContractorId: companyContractor.id,
                totalAmountInUsdCents: 75_00n,
              });
              await invoiceApprovalsFactory.create({
                invoiceId: invoice3.id,
                approverId: anotherAdminUser.id,
              });
              await db.update(invoices).set({ status: "approved" }).where(eq(invoices.id, invoice3.id));

              const { invoice: invoice4 } = await invoicesFactory.create({
                companyId: company.id,
                companyContractorId: companyContractor.id,
                totalAmountInUsdCents: 75_00n,
              });
              await invoiceApprovalsFactory.create({
                invoiceId: invoice4.id,
                approverId: anotherAdminUser.id,
              });
              await db.update(invoices).set({ status: "approved" }).where(eq(invoices.id, invoice4.id));

              await login(page, adminUser);
              await page.getByRole("link", { name: "Invoices" }).click();

              await page.locator("th").getByLabel("Select all").check();
              await expect(page.getByText("4 selected")).toBeVisible();
              await page.getByRole("button", { name: "Approve selected" }).click();

              const invoiceApprovalsCountBefore = await countInvoiceApprovals();
              const consolidatedInvoicesCountBefore = await db.$count(consolidatedInvoices);

              const modal = page.getByRole("dialog");
              await expect(modal.getByText("You are paying $150 now.")).toBeVisible();
              await expect(modal.getByText("$75")).toHaveCount(3); // partially-approved invoices being paid, plus one received invoice being approved
              await expect(modal.getByText("$60")).toHaveCount(1); // received invoice being approved
              await modal.getByRole("button", { name: "Yes, proceed" }).click();

              await expect(page.getByText("No invoices to display.")).toBeVisible();
              const consolidatedInvoicesCountAfter = await db.$count(consolidatedInvoices);
              expect(await countInvoiceApprovals()).toBe(invoiceApprovalsCountBefore + 4);
              expect(consolidatedInvoicesCountAfter).toBe(consolidatedInvoicesCountBefore + 1);

              const updatedInvoices = await getInvoices();
              const expectedPaidInvoices = [invoice3.id, invoice4.id];
              for (const invoice of updatedInvoices) {
                expect(invoice.status).toBe(expectedPaidInvoices.includes(invoice.id) ? "payment_pending" : "approved");
              }
            },
          );
        });
      });

      testContext.describe("rejecting invoices", () => {
        testContext.beforeEach(async () => {
          await invoicesFactory.create({
            companyId: company.id,
            companyContractorId: companyContractor.id,
          });
        });

        testContext("allows rejecting invoices without a reason", async ({ page }) => {
          await login(page, adminUser);
          await page.getByRole("link", { name: "Invoices" }).click();

          await page.locator("th").getByLabel("Select all").check();
          await expect(page.getByText("2 selected")).toBeVisible();
          await page.getByRole("button", { name: "Reject selected" }).click();

          await page.getByRole("button", { name: "Yes, reject" }).click();

          await expect(page.getByText("No invoices to display")).toBeVisible();

          const updatedInvoices = await getInvoices();
          expect(updatedInvoices.length).toBe(2);
          expect(updatedInvoices.every((invoice) => invoice.status === "rejected")).toBe(true);

          await page.getByRole("tab", { name: "History" }).click();
          await Promise.all(
            updatedInvoices.map(async (invoice, index) => {
              expect(invoice.rejectionReason).toBeNull();
              await expect(page.getByRole("row", { name: invoice.billFrom }).nth(index)).toBeVisible();
            }),
          );
        });

        testContext("allows rejecting invoices with a reason", async ({ page }) => {
          await login(page, adminUser);
          await page.getByRole("link", { name: "Invoices" }).click();

          await page.locator("th").getByLabel("Select all").check();
          await expect(page.getByText("2 selected")).toBeVisible();
          await page.getByRole("button", { name: "Reject selected" }).click();

          await page
            .getByLabel("Explain why the invoice was rejected and how to fix it (optional)")
            .fill("Invoice issue date mismatch");
          await page.getByRole("button", { name: "Yes, reject" }).click();

          await expect(page.getByText("No invoices to display")).toBeVisible();

          const updatedInvoices = await getInvoices();
          expect(updatedInvoices.length).toBe(2);
          expect(updatedInvoices.every((invoice) => invoice.status === "rejected")).toBe(true);

          await page.getByRole("tab", { name: "History" }).click();
          await Promise.all(
            updatedInvoices.map(async (invoice, index) => {
              expect(invoice.rejectionReason).toBe("Invoice issue date mismatch");
              await expect(page.getByRole("row", { name: invoice.billFrom }).nth(index)).toBeVisible();
            }),
          );
        });
      });
    });
  };

  test.describe("when company worker has an hourly rate", () => {
    const setup = async () => {
      const { company, user: adminUser } = await setupCompany();
      const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });

      const contractorUser = await db.query.users.findFirst({
        where: eq(users.id, companyContractor.userId),
      });
      assert(contractorUser !== undefined);

      const companyRole = await db.query.companyRoles.findFirst({
        where: eq(companyRoles.id, companyContractor.companyRoleId),
      });
      assert(companyRole !== undefined);

      return {
        company,
        adminUser,
        companyContractor: {
          ...companyContractor,
          companyRole,
          user: contractorUser,
        },
        totalMinutes: 60,
        expectedHours: "01:00",
      };
    };

    sharedInvoiceTests(test, setup);
  });

  test.describe("when company worker has a project-based rate", () => {
    const setup = async () => {
      const { company, user: adminUser } = await setupCompany();
      const { companyContractor } = await companyContractorsFactory.createProjectBased({ companyId: company.id });

      const contractorUser = await db.query.users.findFirst({
        where: eq(users.id, companyContractor.userId),
      });
      assert(contractorUser !== undefined);

      const companyRole = await db.query.companyRoles.findFirst({
        where: eq(companyRoles.id, companyContractor.companyRoleId),
      });
      assert(companyRole !== undefined);

      return {
        company,
        adminUser,
        companyContractor: {
          ...companyContractor,
          companyRole,
          user: contractorUser,
        },
        totalMinutes: null,
        expectedHours: "N/A",
      };
    };

    sharedInvoiceTests(test, setup);
  });

  test.describe("team update tasks", () => {
    test("shows the expected tasks for different invoices", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();
      await db
        .update(companies)
        .set({ teamUpdatesEnabled: true, equityCompensationEnabled: true })
        .where(eq(companies.id, company.id));

      const { user: userA } = await usersFactory.create();
      const { companyContractor: contractorA } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: userA.id,
      });
      const { user: userB } = await usersFactory.create();
      const { companyContractor: contractorB } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: userB.id,
      });

      // Fill updates during the first week
      // INFO: 2024-05-06 is Monday
      const contractorAUpdateWeek1 = await companyContractorUpdatesFactory.create({
        companyId: company.id,
        companyContractorId: contractorA.id,
        periodStartsOn: "2024-05-05",
        periodEndsOn: "2024-05-11",
        createdAt: new Date("2024-05-06"),
      });
      await companyContractorUpdateTasksFactory.create({
        companyContractorUpdateId: contractorAUpdateWeek1.id,
        name: "completed task user A",
        createdAt: new Date("2024-05-06"),
        completedAt: new Date("2024-05-07"),
      });
      await companyContractorUpdateTasksFactory.create({
        companyContractorUpdateId: contractorAUpdateWeek1.id,
        name: "unfinished task user A",
        createdAt: new Date("2024-05-08"),
      });
      const taskWithGithubIntegrationWeek1 = await companyContractorUpdateTasksFactory.create({
        companyContractorUpdateId: contractorAUpdateWeek1.id,
        name: "#merg",
        createdAt: new Date("2024-05-09"),
      });
      await githubIntegrationRecordForTaskFactory.create(taskWithGithubIntegrationWeek1, {
        createdAt: new Date("2024-05-09"),
        jsonData: {
          url: "https://github.com/anti-work-test/flexile/pull/8",
          status: "merged",
          description: "Merged PR",
          resource_id: "8",
          resource_name: "pulls",
        },
      });

      const contractorBUpdateWeek1 = await companyContractorUpdatesFactory.create({
        companyId: company.id,
        companyContractorId: contractorB.id,
        periodStartsOn: "2024-05-05",
        periodEndsOn: "2024-05-11",
        createdAt: new Date("2024-05-06"),
      });
      await companyContractorUpdateTasksFactory.create({
        companyContractorUpdateId: contractorBUpdateWeek1.id,
        name: "unfinished task user B",
        createdAt: new Date("2024-05-09"),
      });

      // send invoices at the end of first week
      await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: contractorA.id,
        totalAmountInUsdCents: 100_00n,
        totalMinutes: 60,
        invoiceDate: "2024-05-11",
        createdAt: new Date("2024-05-12"),
      });
      await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: contractorB.id,
        totalAmountInUsdCents: 150_00n,
        totalMinutes: 90,
        invoiceDate: "2024-05-11",
        createdAt: new Date("2024-05-12"),
      });

      // Fill updates during the second week
      const contractorUpdateAWeek2 = await companyContractorUpdatesFactory.create({
        companyId: company.id,
        companyContractorId: contractorA.id,
        periodStartsOn: "2024-05-12",
        periodEndsOn: "2024-05-18",
        createdAt: new Date("2024-05-13"),
      });

      const taskWithGithubIntegrationWeek2 = await companyContractorUpdateTasksFactory.create({
        companyContractorUpdateId: contractorUpdateAWeek2.id,
        name: "https://github.com/anti-work/flexile/pull/3791",
        createdAt: new Date("2024-05-14"),
      });
      await githubIntegrationRecordForTaskFactory.create(taskWithGithubIntegrationWeek2, {
        createdAt: new Date("2024-05-14"),
        jsonData: {
          url: "https://github.com/anti-work-test/flexile/pull/99",
          status: "draft",
          description: "A draft PR",
          resource_id: "99",
          resource_name: "pulls",
        },
      });

      // send invoice at the end of second week
      await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: contractorA.id,
        totalAmountInUsdCents: 100_00n,
        totalMinutes: 60,
        invoiceDate: "2024-05-18",
        createdAt: new Date("2024-05-19"),
      });

      await login(page, adminUser);
      // INFO: 2024-05-20 is Monday
      await page.clock.setFixedTime(new Date("2024-05-20T20:00:00Z"));
      await page.getByRole("link", { name: "Invoices" }).click();

      await page.getByRole("row", { name: userB.legalName ?? "" }).click();
      // const tasks = page.locator("section > header+div > ul");
      const tasks = page
        .locator("dialog section")
        .filter({ has: page.locator("header", { hasText: "Tasks" }) })
        .locator("ul");

      await expect(tasks).toBeVisible();
      expect(await tasks.locator("li").count()).toBe(1);
      await expect(tasks.getByText("unfinished task user B")).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page
        .getByRole("row", { name: userA.legalName ?? "" })
        .filter({ hasText: "May 11, 2024" })
        .click();
      await expect(tasks).toBeVisible();
      expect(await tasks.locator("li").count()).toBe(3);
      await expect(tasks.getByText("completed task user A")).toBeVisible();
      await expect(tasks.getByText("unfinished task user A")).toBeVisible();
      await expect(tasks.getByRole("link", { name: "#8 Merged PR" })).toHaveAttribute(
        "href",
        "https://github.com/anti-work-test/flexile/pull/8",
      );
      await page.getByRole("button", { name: "Close" }).click();

      await page
        .getByRole("row", { name: userA.legalName ?? "" })
        .filter({ hasText: "May 18, 2024" })
        .click();
      await expect(tasks).toBeVisible();
      expect(await tasks.locator("li").count()).toBe(1);
      await expect(tasks.getByRole("link", { name: "#99 A draft PR" })).toHaveAttribute(
        "href",
        "https://github.com/anti-work-test/flexile/pull/99",
      );
    });

    test("shows the expected UI based on the company's feature flags", async ({ page }) => {
      const { company, user: adminUser } = await setupCompany();

      const equityLine = page.locator("dialog[open] section").getByText("Swapped for equity (10%)");

      const { invoice } = await invoicesFactory.create({
        companyId: company.id,
        totalAmountInUsdCents: 150_00n,
        totalMinutes: 90,
        invoiceDate: "2024-05-11",
        createdAt: new Date("2024-05-12"),
      });

      const tasksSection = page.locator("dialog section").filter({ has: page.locator("header", { hasText: "Tasks" }) });

      await login(page, adminUser);
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.locator("tbody tr").first().click();
      await expect(page.locator("dialog[open]", { hasText: "INVOICE DETAILS" })).toBeVisible();
      await expect(equityLine).not.toBeVisible();
      await expect(tasksSection).not.toBeVisible();

      await db
        .update(companies)
        .set({ teamUpdatesEnabled: true, equityCompensationEnabled: false })
        .where(eq(companies.id, company.id));
      await page.reload();
      await page.locator("tbody tr").first().click();
      await expect(page.locator("dialog[open]", { hasText: "INVOICE DETAILS" })).toBeVisible();
      await expect(equityLine).not.toBeVisible();
      await expect(tasksSection).toBeVisible();

      await db
        .update(companies)
        .set({ teamUpdatesEnabled: false, equityCompensationEnabled: true })
        .where(eq(companies.id, company.id));
      await db
        .update(invoices)
        .set({ equityAmountInCents: 100_00n, equityPercentage: 10 })
        .where(eq(invoices.id, invoice.id));
      await page.reload();
      await page.locator("tbody tr").first().click();
      await expect(page.locator("dialog[open]", { hasText: "INVOICE DETAILS" })).toBeVisible();
      await expect(equityLine).toBeVisible();
      await expect(tasksSection).not.toBeVisible();

      await db
        .update(companies)
        .set({ teamUpdatesEnabled: true, equityCompensationEnabled: true })
        .where(eq(companies.id, company.id));
      await page.reload();
      await page.locator("tbody tr").first().click();
      await expect(page.locator("dialog[open]", { hasText: "INVOICE DETAILS" })).toBeVisible();
      await expect(equityLine).toBeVisible();
      await expect(tasksSection).toBeVisible();
    });
  });
});
