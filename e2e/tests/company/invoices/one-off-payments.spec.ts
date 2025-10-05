import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login, logout } from "@test/helpers/auth";
import { findRequiredTableRow } from "@test/helpers/matchers";
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
    const result = await companiesFactory.createCompletedOnboarding();
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
      expect(invoice).toEqual(
        expect.objectContaining({
          totalAmountInUsdCents: BigInt(215430),
          equityPercentage: 0,
          cashAmountInCents: BigInt(215430),
          equityAmountInCents: BigInt(0),
          equityAmountInOptions: 0,
          acceptedAt: expect.any(Date),
        }),
      );

      expect(sentEmails).toEqual([
        expect.objectContaining({
          to: workerUser.email,
          subject: `💰 ${company.name} has sent you money`,
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
      await page.getByRole("link").getByText("provide your legal details").click();
      await page.getByLabel("Full legal name (must match your ID)").fill("Legal Name");
      await page.getByLabel("Tax ID").fill("123456789");
      await page.getByRole("button", { name: "Save changes" }).click();
      await withinModal(async (modal) => modal.getByRole("button", { name: "Save", exact: true }).click(), { page });
      await page.getByRole("link", { name: "Back to app" }).click();
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("link", { name: invoice.invoiceNumber }).click();
      await expect(page.getByRole("button", { name: "Accept payment" })).not.toBeVisible();

      const updatedInvoice = await db.query.invoices
        .findFirst({ where: eq(invoices.id, invoice.id) })
        .then(takeOrThrow);
      expect(updatedInvoice.billFrom).toBe("Legal Name");
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

      test("errors when default equity cannot be calculated (no grant and no share price)", async ({ page }) => {
        await db.update(companies).set({ fmvPerShareInUsd: null }).where(eq(companies.id, company.id));
        await db.delete(equityGrants).where(eq(equityGrants.companyInvestorId, companyInvestor.id));
        await db
          .update(companyContractors)
          .set({ equityPercentage: 10 })
          .where(eq(companyContractors.id, companyContractor.id));

        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);
        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
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
      });

      test("uses contractor's default equity percentage", async ({ page, sentEmails }) => {
        await db
          .update(companyContractors)
          .set({ equityPercentage: 10 })
          .where(eq(companyContractors.userId, workerUser.id));

        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await modal.getByLabel("Amount").fill("500.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
            await modal.getByRole("button", { name: "Issue payment" }).click();
          },
          { page },
        );

        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.invoiceNumber, "O-0001"), eq(invoices.companyId, company.id)),
        });
        expect(invoice).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: BigInt(50000),
            equityPercentage: 10,
            cashAmountInCents: BigInt(45000),
            equityAmountInCents: BigInt(5000),
            equityAmountInOptions: 5,
            acceptedAt: expect.any(Date),
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `💰 ${company.name} has sent you money`,
            text: expect.stringContaining("has sent you money"),
          }),
        ]);
      });

      test("fails payment creation when insufficient equity available", async ({ page }) => {
        await db
          .update(equityGrants)
          .set({
            unvestedShares: 10,
            exercisedShares: 0,
            forfeitedShares: 0,
          })
          .where(eq(equityGrants.companyInvestorId, companyInvestor.id));

        await db
          .update(companyContractors)
          .set({ equityPercentage: 80 })
          .where(eq(companyContractors.id, companyContractor.id));

        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await modal.getByLabel("Amount").fill("400.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment");

            await Promise.all([
              page.waitForResponse((r) => r.url().includes("invoices.createAsAdmin") && r.status() === 400),
              modal.getByRole("button", { name: "Issue payment" }).click(),
            ]);

            await expect(modal.getByText("Recipient has insufficient unvested equity")).toBeVisible();
          },
          { page, assertClosed: false },
        );
      });
    });
  });

  test.describe("invoice list visibility", () => {
    test("shows one-off payments in the admin invoice list immediately since they're auto-accepted", async ({
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

      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.invoiceNumber, "O-0001"), eq(invoices.companyId, company.id)),
      });
      expect(invoice?.acceptedAt).toBeDefined();

      await logout(page);
      await login(page, workerUser);

      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = await findRequiredTableRow(page, {
        "Invoice ID": "O-0001",
        Amount: "$123.45",
      });

      await invoiceRow.getByRole("link", { name: "O-0001" }).click();
      await expect(page.getByRole("cell", { name: "Bonus!" })).toBeVisible();

      await expect(page.getByRole("button", { name: "Accept payment" })).not.toBeVisible();

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

      await expect(page.locator("tbody")).toBeVisible();

      const invoiceRow = await findRequiredTableRow(page, {
        Amount: "$500",
        Status: "Failed",
      });

      await invoiceRow.getByRole("button", { name: "Pay again" }).click();

      await expect(page.getByText("Payment initiated")).toBeVisible();
    });
  });
});
