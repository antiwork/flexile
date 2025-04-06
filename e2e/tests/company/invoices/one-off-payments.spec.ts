import { clerk } from "@clerk/testing/playwright";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { findRequiredTableRow } from "@test/helpers/matchers";
import { expect, test } from "@test/index";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
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
      await login(page, adminUser);

      await page.goto(`/people/${workerUser.externalId}?tab=invoices`);
      await page.getByRole("button", { name: "Issue payment" }).click();

      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();

      await modal.getByLabel("Amount").fill("2154.30");
      await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
      await modal.getByRole("button", { name: "Issue payment" }).click();
      await page.waitForLoadState("networkidle");

      await expect(modal).not.toBeVisible();

      const invoiceRow = await findRequiredTableRow(page, {
        "Invoice ID": "O-0001",
        "Sent on": format(new Date(), "MMM d, yyyy"),
        Paid: "-",
        Hours: "N/A",
        Amount: "$2,154.30",
      });
      await expect(invoiceRow.getByText("Awaiting approval (1/2)")).toBeVisible();

      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.invoiceNumber, "O-0001"),
      });
      expect(invoice).toEqual(
        expect.objectContaining({
          totalAmountInUsdCents: 215430n,
          equityPercentage: 0,
          cashAmountInCents: 215430n,
          equityAmountInCents: 0n,
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
        await db.update(companies).set({ equityCompensationEnabled: true }).where(eq(companies.id, company.id));

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

      test("errors if the worker has no equity grant", async ({ page }) => {
        await db.delete(equityGrants).where(eq(equityGrants.companyInvestorId, companyInvestor.id));

        await login(page, adminUser);

        await page.goto(`/people/${workerUser.externalId}?tab=invoices`);
        await page.getByRole("button", { name: "Issue payment" }).click();

        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();

        await modal.getByLabel("Amount").fill("50000.00");
        await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
        await modal.getByPlaceholder("Enter percentage").fill("80");
        await modal.getByRole("button", { name: "Issue payment" }).click();
        await page.waitForLoadState("networkidle");

        await expect(modal.getByText("Recipient has insufficient unvested equity")).toBeVisible();
      });

      test("with a fixed equity percentage", async ({ page, sentEmails }) => {
        await login(page, adminUser);

        await page.goto(`/people/${workerUser.externalId}?tab=invoices`);
        await page.getByRole("button", { name: "Issue payment" }).click();

        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();

        await modal.getByLabel("Amount").fill("500.00");
        await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
        await modal.getByPlaceholder("Enter percentage").fill("10");
        await modal.getByRole("button", { name: "Issue payment" }).click();
        await page.waitForLoadState("networkidle");

        await expect(modal).not.toBeVisible();

        const invoiceRow = await findRequiredTableRow(page, {
          "Invoice ID": "O-0001",
          "Sent on": format(new Date(), "MMM d, yyyy"),
          Paid: "-",
          Hours: "N/A",
          Amount: "$500",
        });
        await expect(invoiceRow.getByText("Awaiting approval (1/2)")).toBeVisible();

        const invoice = await db.query.invoices.findFirst({
          where: eq(invoices.invoiceNumber, "O-0001"),
        });
        expect(invoice).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: 50000n,
            equityPercentage: 10,
            cashAmountInCents: 45000n,
            equityAmountInCents: 5000n,
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
        await login(page, adminUser);

        await page.goto(`/people/${workerUser.externalId}?tab=invoices`);
        await page.getByRole("button", { name: "Issue payment" }).click();

        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();

        await modal.getByLabel("Amount").fill("500.00");
        await modal.getByLabel("What is this for?").fill("Bonus payment for Q4");
        await modal.getByLabel("Equity percentage range").click();

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
        await page.waitForLoadState("networkidle");

        await expect(modal).not.toBeVisible();

        const invoiceRow = await findRequiredTableRow(page, {
          "Invoice ID": "O-0001",
          "Sent on": format(new Date(), "MMM d, yyyy"),
          Paid: "-",
          Hours: "N/A",
          Amount: "$500",
        });
        await expect(invoiceRow.getByText("Awaiting approval (1/2)")).toBeVisible();

        const invoice = await db.query.invoices.findFirst({
          where: eq(invoices.invoiceNumber, "O-0001"),
        });
        expect(invoice).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: 50000n,
            equityPercentage: 25,
            cashAmountInCents: 37500n,
            equityAmountInCents: 12500n,
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
        await login(page, workerUser);

        await page.goto(`/invoices/${invoice.externalId}`);
        await page.getByRole("button", { name: "Accept payment" }).click();
        await page.waitForLoadState("networkidle");

        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();

        await modal.getByRole("button", { name: "Accept payment" }).click();
        await expect(modal).not.toBeVisible();
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
          equityAmountInCents: 0n,
          equityAmountInOptions: 0,
          cashAmountInCents: BigInt(50000),
          totalAmountInUsdCents: BigInt(50000),
          minAllowedEquityPercentage: 0,
          maxAllowedEquityPercentage: 100,
        });
        await login(page, workerUser);

        await page.goto(`/invoices/${invoice.externalId}`);
        await page.getByRole("button", { name: "Accept payment" }).click();
        await page.waitForLoadState("networkidle");

        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();

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
        await expect(modal).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Confirm 25% split" })).not.toBeVisible();

        await page.waitForLoadState("networkidle");
        expect(
          await db.query.invoices.findFirst({
            where: eq(invoices.invoiceNumber, invoice.invoiceNumber),
          }),
        ).toEqual(
          expect.objectContaining({
            totalAmountInUsdCents: 50000n,
            equityPercentage: 25,
            cashAmountInCents: 37500n,
            equityAmountInCents: 12500n,
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
      await login(page, adminUser);

      await page.goto(`/people/${workerUser.externalId}?tab=invoices`);
      await page.getByRole("button", { name: "Issue payment" }).click();

      const modal = page.getByRole("dialog");

      await modal.getByLabel("Amount").fill("123.45");
      await modal.getByLabel("What is this for?").fill("Bonus!");
      await modal.getByRole("button", { name: "Issue payment" }).click();

      await expect(modal).not.toBeVisible();

      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByText("No invoices to display.")).toBeVisible();
      await page.getByRole("tab", { name: "History" }).click();
      await page.waitForURL(/tab=history/u);
      await expect(page.getByText("No invoices to display.")).toBeVisible();

      await clerk.signOut({ page });
      await login(page, workerUser);

      await page.getByRole("link", { name: "Invoices" }).click();

      const invoiceRow = await findRequiredTableRow(page, {
        "Invoice ID": "O-0001",
        Amount: "$123.45",
      });

      await invoiceRow.click();
      await expect(page.getByRole("cell", { name: "Bonus!" })).toBeVisible();
      // await page.waitForTimeout(100000);

      await page.getByRole("button", { name: "Accept payment" }).click();
      const acceptPaymentModal = page.getByRole("dialog");
      await expect(acceptPaymentModal).toContainText("Total value $123.45", { useInnerText: true });
      await acceptPaymentModal.getByRole("button", { name: "Accept payment" }).click();
      await expect(acceptPaymentModal).not.toBeVisible();

      await clerk.signOut({ page });
      await login(page, adminUser);

      await page.getByRole("link", { name: "Invoices" }).click();
      await expect(page.getByText("No invoices to display.")).toBeVisible();
      await page.getByRole("tab", { name: "History" }).click();
      await page.waitForURL(/tab=history/u);
      await expect(page.getByText("No invoices to display.")).not.toBeVisible();
      await expect(page.getByRole("row", { name: "$123.45" })).toBeVisible();

      await db.update(companies).set({ requiredInvoiceApprovalCount: 1 }).where(eq(companies.id, company.id));

      await page.reload();
      await page.waitForURL(/tab=history/u);
      await expect(page.getByText("No invoices to display.")).toBeVisible();

      await page.getByRole("tab", { name: "Open" }).click();
      await page.waitForURL(/invoices$/u);
      await expect(page.getByRole("row", { name: "$123.45" })).toBeVisible();

      await page.getByRole("button", { name: "Pay now" }).click();

      await expect(page.getByText("No invoices to display.")).toBeVisible();
      await page.getByRole("tab", { name: "History" }).click();
      await page.waitForURL(/tab=history/u);
      await expect(page.getByRole("row", { name: "$123.45 Payment scheduled" })).toBeVisible();
    });
  });
});
