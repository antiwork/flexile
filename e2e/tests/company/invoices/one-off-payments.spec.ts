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
import { companies, equityGrants, invoices } from "@/db/schema";

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
      await expect(page.getByRole("dialog")).not.toBeVisible();

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
        }),
      );

      expect(sentEmails).toEqual([
        expect.objectContaining({
          to: workerUser.email,
          subject: `🔴 Action needed: ${company.name} would like to pay you`,
          text: expect.stringContaining("would like to send you money"),
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
            await modal.getByRole("button", { name: "Issue payment" }).click();
            await page.waitForLoadState("networkidle");
            await expect(modal.getByText("Recipient has insufficient unvested equity")).toBeVisible();
          },
          { page },
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
        await expect(page.getByRole("dialog")).not.toBeVisible();

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
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `🔴 Action needed: ${company.name} would like to pay you`,
            text: expect.stringContaining("would like to send you money"),
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

            const sliderContainer = modal.locator('[data-orientation="horizontal"]').first();
            const containerBounds = await sliderContainer.boundingBox();
            if (!containerBounds) throw new Error("Could not get slider container bounds");

            // Move minimum thumb to 25%
            const minThumb = modal.getByRole("slider", { name: "Minimum" });
            const minThumbBounds = await minThumb.boundingBox();
            if (!minThumbBounds) throw new Error("Could not get min thumb bounds");

            await minThumb.hover();
            await page.mouse.down();
            await page.mouse.move(
              containerBounds.x + containerBounds.width * 0.25,
              containerBounds.y + containerBounds.height / 2,
            );
            await page.mouse.up();

            // Move maximum thumb to 75%
            const maxThumb = modal.getByRole("slider", { name: "Maximum" });
            const maxThumbBounds = await maxThumb.boundingBox();
            if (!maxThumbBounds) throw new Error("Could not get max thumb bounds");

            await maxThumb.hover();
            await page.mouse.down();
            await page.mouse.move(
              containerBounds.x + containerBounds.width * 0.75,
              containerBounds.y + containerBounds.height / 2,
            );
            await page.mouse.up();

            await modal.getByRole("button", { name: "Issue payment" }).click();
          },
          { page },
        );
        await expect(page.getByRole("dialog")).not.toBeVisible();

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
          }),
        );

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: workerUser.email,
            subject: `🔴 Action needed: ${company.name} would like to pay you`,
            text: expect.stringContaining("would like to send you money"),
          }),
        ]);
      });

      test("allows a worker to accept a one-off payment with a fixed equity percentage", async ({ page }) => {
        const { invoice } = await invoicesFactory.create({
          userId: workerUser.id,
          companyId: company.id,
          companyContractorId: companyContractor.id,
          createdById: adminUser.id,
          invoiceType: "other",
          status: "approved",
          equityPercentage: 10,
          equityAmountInCents: BigInt(600),
          equityAmountInOptions: 60,
          cashAmountInCents: BigInt(5400),
          totalAmountInUsdCents: BigInt(6000),
        });
        await login(page, workerUser, `/invoices/${invoice.externalId}`);

        await page.getByRole("button", { name: "Accept payment" }).click();
        await page.waitForLoadState("networkidle");

        await withinModal(async (modal) => modal.getByRole("button", { name: "Accept payment" }).click(), { page });

        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Accept payment" })).not.toBeVisible();
      });

      test("allows a worker to accept a one-off payment with an allowed equity percentage range", async ({ page }) => {
        const { invoice } = await invoicesFactory.create({
          userId: workerUser.id,
          companyId: company.id,
          companyContractorId: companyContractor.id,
          createdById: adminUser.id,
          invoiceType: "other",
          status: "approved",
          equityPercentage: 0,
          equityAmountInCents: BigInt(0),
          equityAmountInOptions: 0,
          cashAmountInCents: BigInt(50000),
          totalAmountInUsdCents: BigInt(50000),
          minAllowedEquityPercentage: 0,
          maxAllowedEquityPercentage: 100,
        });
        await login(page, workerUser, `/invoices/${invoice.externalId}`);

        await page.getByRole("button", { name: "Accept payment" }).click();
        await page.waitForLoadState("networkidle");

        await withinModal(
          async (modal) => {
            const sliderContainer = modal.locator('[data-orientation="horizontal"]').first();
            const containerBounds = await sliderContainer.boundingBox();
            if (!containerBounds) throw new Error("Could not get slider container bounds");

            // Move equity thumb to 25%
            const equityPercentageThumb = modal.getByRole("slider");
            const thumbBounds = await equityPercentageThumb.boundingBox();
            if (!thumbBounds) throw new Error("Could not get equity thumb bounds");

            await equityPercentageThumb.hover();
            await page.mouse.down();
            await page.mouse.move(
              containerBounds.x + containerBounds.width * 0.25,
              containerBounds.y + containerBounds.height / 2,
            );
            await page.mouse.up();

            await modal.getByRole("button", { name: "Confirm 25% split" }).click();
          },
          { page },
        );

        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Confirm 25% split" })).not.toBeVisible();

        await page.waitForLoadState("networkidle");
        expect(await db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) })).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: BigInt(50000),
            equityPercentage: 25,
            cashAmountInCents: BigInt(37500),
            equityAmountInCents: BigInt(12500),
            equityAmountInOptions: 13,
            minAllowedEquityPercentage: 0,
            maxAllowedEquityPercentage: 100,
          }),
        );
      });
    });
  });

  test.describe("invoice list visibility", () => {
    test("does not show one-off payments in the admin invoice list while they're not accepted by the payee", async ({
      page,
      sentEmails: _,
    }) => {
      await login(page, adminUser, `/people/${workerUser.externalId}?tab=invoices`);

      await page.getByRole("button", { name: "Issue payment" }).click();

      await withinModal(
        async (modal) => {
          await modal.getByLabel("Amount").fill("123.45");
          await modal.getByLabel("What is this for?").fill("Bonus!");
          await modal.getByRole("button", { name: "Issue payment" }).click();
        },
        { page },
      );
      await expect(page.getByRole("dialog")).not.toBeVisible();

      await logout(page);
      await login(page, workerUser);

      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = await findRequiredTableRow(page, {
        "Invoice ID": "O-0001",
        Amount: "$123.45",
      });

      await invoiceRow.getByRole("link", { name: "O-0001" }).click();
      await expect(page.getByRole("cell", { name: "Bonus!" })).toBeVisible();

      await page.getByRole("button", { name: "Accept payment" }).click();
      await withinModal(
        async (modal) => {
          await expect(modal).toContainText("Total value $123.45", { useInnerText: true });
          await modal.getByRole("button", { name: "Accept payment" }).click();
        },
        { page },
      );

      await expect(page.getByRole("dialog")).not.toBeVisible();

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
