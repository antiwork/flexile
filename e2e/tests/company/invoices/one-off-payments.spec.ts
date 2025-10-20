import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login, logout } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { and, eq } from "drizzle-orm";
import { companies, companyContractors, equityGrants, invoices } from "@/db/schema";

type User = Awaited<ReturnType<typeof usersFactory.create>>["user"];
type Company = Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
type CompanyContractor = Awaited<ReturnType<typeof companyContractorsFactory.create>>["companyContractor"];
type CompanyInvestor = Awaited<ReturnType<typeof companyInvestorsFactory.create>>["companyInvestor"];

test.describe("One-off payments", () => {
  let company: Company;
  let adminUser: User;
  let workerUser: User;
  let companyContractor: CompanyContractor;
  let companyInvestor: CompanyInvestor;

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding({ isTrusted: true });
    adminUser = result.adminUser;
    company = result.company;
    workerUser = (await usersFactory.create()).user;
    companyContractor = (
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: workerUser.id,
      })
    ).companyContractor;
  });

  test.describe("admin creates a payment", () => {
    test("prevents creating payment when contractor has no bank account", async ({ page }) => {
      const workerWithoutBank = (await usersFactory.create()).user;
      await companyContractorsFactory.create(
        {
          companyId: company.id,
          userId: workerWithoutBank.id,
          payRateInSubunits: 5000,
        },
        { withoutBankAccount: true },
      );

      await login(page, adminUser, `/people/${workerWithoutBank.externalId}?tab=invoices`);

      await page.getByRole("button", { name: "Issue payment" }).click();

      await withinModal(
        async (modal) => {
          await modal.getByLabel("Amount").fill("100.00");
          await modal.getByLabel("What is this for?").fill("Test payment");
          await modal.getByRole("button", { name: "Issue payment" }).click();

          await expect(modal.getByText(/configure your bank account/iu)).toBeVisible();
        },
        { page, assertClosed: false },
      );

      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.companyId, company.id), eq(invoices.userId, workerWithoutBank.id)),
      });
      expect(invoice).toBeUndefined();
    });

    test("allows admin to create a one-off payment for a contractor without equity", async ({ page, sentEmails }) => {
      await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

      await page.getByRole("button", { name: "Issue payment" }).click();

      await withinModal(
        async (modal) => {
          await modal.getByLabel("Amount").fill("2154.30");
          await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
          await modal.getByRole("button", { name: "Issue payment" }).click();
        },
        { page },
      );

      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.invoiceNumber, "O-0001"), eq(invoices.companyId, company.id)),
      });
      expect(invoice?.acceptedAt).not.toBeNull();
      expect(invoice).toEqual(
        expect.objectContaining({
          totalAmountInUsdCents: BigInt(215430),
          equityPercentage: 0,
          cashAmountInCents: BigInt(215430),
          equityAmountInCents: BigInt(0),
          equityAmountInOptions: 0,
          minAllowedEquityPercentage: null,
          maxAllowedEquityPercentage: null,
        }),
      );

      expect(sentEmails).toEqual([
        expect.objectContaining({
          to: workerUser.email,
          subject: `${company.name} has sent you money`,
          text: expect.stringContaining("has sent you money"),
        }),
      ]);
    });

    test("allows admin to create a payment for a user without a completed profile", async ({ page, sentEmails: _ }) => {
      const preOnboardingUser = (await usersFactory.create({ legalName: null }, { withoutComplianceInfo: true })).user;
      await companyContractorsFactory.create({ companyId: company.id, userId: preOnboardingUser.id });

      await login(page, adminUser, `/people/${preOnboardingUser.externalId}?tab=invoices`);

      await page.getByRole("button", { name: "Issue payment" }).click();

      await withinModal(
        async (modal) => {
          await modal.getByLabel("Amount").fill("1000.00");
          await modal.getByLabel("What is this for?").fill("Payment before profile completion");
          await modal.getByRole("button", { name: "Issue payment" }).click();
        },
        { page },
      );

      const invoice = await db.query.invoices
        .findFirst({ where: eq(invoices.companyId, company.id) })
        .then(takeOrThrow);
      expect(invoice.billFrom).toBeNull();

      await logout(page);
      await login(page, preOnboardingUser, `/invoices/${invoice.externalId}`);
      await expect(page.getByText("Missing tax information.")).toBeVisible();
      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByRole("link").getByText("provide your legal details")).toBeVisible();
    });

    test.describe("for a contractor with equity", () => {
      test.beforeEach(async () => {
        await db.update(companies).set({ equityEnabled: true }).where(eq(companies.id, company.id));

        companyInvestor = (
          await companyInvestorsFactory.create({
            companyId: company.id,
            userId: workerUser.id,
          })
        ).companyInvestor;

        await equityGrantsFactory.createActive(
          {
            companyInvestorId: companyInvestor.id,
          },
          { year: new Date().getFullYear() },
        );
      });

      test("errors if the worker has no equity grant and the company does not have a share price", async ({ page }) => {
        await db
          .update(companyContractors)
          .set({ equityPercentage: 80 })
          .where(eq(companyContractors.id, companyContractor.id));

        await db.update(companies).set({ fmvPerShareInUsd: null }).where(eq(companies.id, company.id));
        await db.delete(equityGrants).where(eq(equityGrants.companyInvestorId, companyInvestor.id));

        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);
        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await expect(modal.getByText("will receive 80% equity")).toBeVisible();
            await modal.getByLabel("Amount").fill("50000.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
            await Promise.all([
              page.waitForResponse((r) => r.url().includes("invoices.createAsAdmin") && r.status() === 400),
              modal.getByRole("button", { name: "Issue payment" }).click(),
            ]);
            await expect(modal.getByText("Recipient has insufficient unvested equity")).toBeVisible();
          },
          { page, assertClosed: false },
        );

        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.invoiceNumber, "O-0001"), eq(invoices.companyId, company.id)),
        });
        expect(invoice).toBeUndefined();
      });

      test("uses the contractor's configured equity percentage", async ({ page, sentEmails }) => {
        await db
          .update(companyContractors)
          .set({ equityPercentage: 15 })
          .where(eq(companyContractors.id, companyContractor.id));

        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await expect(modal.getByText("will receive 15% equity")).toBeVisible();
            await modal.getByLabel("Amount").fill("500.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
            await modal.getByRole("button", { name: "Issue payment" }).click();
          },
          { page },
        );

        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.invoiceNumber, "O-0001"), eq(invoices.companyId, company.id)),
        });
        expect(invoice?.acceptedAt).not.toBeNull();
        expect(invoice).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: BigInt(50000),
            equityPercentage: 15,
            cashAmountInCents: BigInt(42500),
            equityAmountInCents: BigInt(7500),
            equityAmountInOptions: 8,
            minAllowedEquityPercentage: null,
            maxAllowedEquityPercentage: null,
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `${company.name} has sent you money`,
            text: expect.stringContaining("has sent you money"),
          }),
        ]);
      });
    });
  });

  test.describe("invoice list visibility", () => {
    test("displays one-off payments in the admin invoice list without requiring acceptance by the payee", async ({
      page,
      sentEmails: _,
    }) => {
      await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

      await page.getByRole("button", { name: "Issue payment" }).click();

      await withinModal(
        async (modal) => {
          await modal.getByLabel("Amount").fill("123.45");
          await modal.getByLabel("What is this for?").fill("Bonus!");
          await modal.getByLabel("What is this for?").blur();
          await modal.getByRole("button", { name: "Issue payment" }).click();
          await page.waitForLoadState("networkidle");
        },
        { page },
      );

      await logout(page);
      await login(page, workerUser);

      await page.getByRole("link", { name: "Invoices" }).click();

      await page
        .getByTableRowCustom({
          "Invoice ID": "O-0001",
          Amount: "$123.45",
        })
        .getByRole("link", { name: "O-0001" })
        .click();

      await expect(page.getByRole("cell", { name: "Bonus!" })).toBeVisible();

      await logout(page);
      await login(page, adminUser);
      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByRole("row", { name: "$123.45" })).toBeVisible();

      await db.update(companies).set({ requiredInvoiceApprovalCount: 1 }).where(eq(companies.id, company.id));

      await page.reload();
      await expect(page.getByRole("row", { name: "$123.45" })).toBeVisible();

      await page.getByRole("button", { name: "Pay now" }).click();
      await page.getByRole("button", { name: "Filter" }).click();
      await page.getByRole("menuitem", { name: "Clear all filters" }).click();

      await expect(page.getByRole("row", { name: "$123.45 Payment scheduled" })).toBeVisible();
    });

    test("shows 'Pay again' button for failed payments", async ({ page }) => {
      const { invoice } = await invoicesFactory.create({
        companyId: company.id,
        companyContractorId: companyContractor.id,
        status: "approved",
        totalAmountInUsdCents: BigInt(50000),
        invoiceNumber: "O-0002",
      });

      await db.update(invoices).set({ status: "failed" }).where(eq(invoices.id, invoice.id));

      await login(page, adminUser, "/invoices");

      await page
        .getByTableRowCustom({
          Amount: "$500",
          Status: "Failed",
        })
        .getByRole("button", { name: "Pay again" })
        .click();

      await expect(page.getByText("Payment initiated")).toBeVisible();
    });
  });
});
