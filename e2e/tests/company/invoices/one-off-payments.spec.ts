import { db } from "@test/db";
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
          minAllowedEquityPercentage: null,
          maxAllowedEquityPercentage: null,
          acceptedAt: expect.any(Date),
        }),
      );

      expect(sentEmails).toEqual([
        expect.objectContaining({
          to: workerUser.email,
          subject: `💰 ${company.name} has sent you a payment`,
          text: expect.stringContaining("has sent you a payment"),
        }),
      ]);
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
        await db.update(companies).set({ fmvPerShareInUsd: null }).where(eq(companies.id, company.id));
        await db.delete(equityGrants).where(eq(equityGrants.companyInvestorId, companyInvestor.id));

        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);
        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await modal.getByLabel("Amount").fill("50000.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
            await modal.getByLabel("Equity percentage", { exact: true }).fill("80");
            await Promise.all([
              page.waitForResponse((r) => r.url().includes("invoices.createAsAdmin") && r.status() === 400),
              modal.getByRole("button", { name: "Issue payment" }).click(),
            ]);
            await expect(modal.getByText("Recipient has insufficient unvested equity")).toBeVisible();
          },
          { page, assertClosed: false },
        );
      });

      test("with a fixed equity percentage", async ({ page, sentEmails }) => {
        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await modal.getByLabel("Amount").fill("500.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
            await modal.getByLabel("Equity percentage", { exact: true }).fill("10");
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
            minAllowedEquityPercentage: null,
            maxAllowedEquityPercentage: null,
            acceptedAt: expect.any(Date),
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `💰 ${company.name} has sent you a payment`,
            text: expect.stringContaining("has sent you a payment"),
          }),
        ]);
      });

      test("with an allowed equity percentage range", async ({ page, sentEmails }) => {
        await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

        await page.getByRole("button", { name: "Issue payment" }).click();

        await withinModal(
          async (modal) => {
            await modal.getByLabel("Amount").fill("500.00");
            await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
            await modal.getByLabel("Equity percentage range").evaluate((x) => x instanceof HTMLElement && x.click()); // playwright breaks on the hidden radio inputs

            // Move minimum thumb to 25%
            const minThumb = modal.getByRole("slider", { name: "Minimum" });
            await minThumb.focus();
            await minThumb.press("Home"); // Start at 0%
            // Move to 25% by pressing Arrow Right 25 times (assuming 1% per step)
            for (let i = 0; i < 25; i++) {
              await minThumb.press("ArrowRight");
            }

            // Move maximum thumb to 75%
            const maxThumb = modal.getByRole("slider", { name: "Maximum" });
            await maxThumb.focus();
            await maxThumb.press("End"); // Start at 100%
            // Move to 75% by pressing Arrow Left 25 times (from 100% to 75%)
            for (let i = 0; i < 25; i++) {
              await maxThumb.press("ArrowLeft");
            }

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
            equityPercentage: 25,
            cashAmountInCents: BigInt(37500),
            equityAmountInCents: BigInt(12500),
            equityAmountInOptions: 13,
            minAllowedEquityPercentage: 25,
            maxAllowedEquityPercentage: 75,
            acceptedAt: expect.any(Date),
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `💰 ${company.name} has sent you a payment`,
            text: expect.stringContaining("has sent you a payment"),
          }),
        ]);
      });

      test("clamps contractor's preferred equity to the admin's allowed range", async ({ page, sentEmails }) => {
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
            await modal.getByLabel("Equity percentage range").evaluate((x) => x instanceof HTMLElement && x.click());

            // Set range to 10% - 30%
            const minThumb = modal.getByRole("slider", { name: "Minimum" });
            await minThumb.focus();
            await minThumb.press("Home");
            for (let i = 0; i < 10; i++) {
              await minThumb.press("ArrowRight");
            }

            const maxThumb = modal.getByRole("slider", { name: "Maximum" });
            await maxThumb.focus();
            for (let i = 0; i < 70; i++) {
              await maxThumb.press("ArrowLeft");
            }

            await modal.getByRole("button", { name: "Issue payment" }).click();
          },
          { page },
        );

        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.invoiceNumber, "O-0001"), eq(invoices.companyId, company.id)),
        });
        expect(invoice).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: BigInt(40000),
            equityPercentage: 30,
            cashAmountInCents: BigInt(28000),
            equityAmountInCents: BigInt(12000),
            equityAmountInOptions: 12,
            minAllowedEquityPercentage: 10,
            maxAllowedEquityPercentage: 30,
            acceptedAt: expect.any(Date),
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `💰 ${company.name} has sent you a payment`,
            text: expect.stringContaining("has sent you a payment"),
          }),
        ]);
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
