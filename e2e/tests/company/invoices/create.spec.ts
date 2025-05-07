import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { subDays } from "date-fns";
import { desc, eq } from "drizzle-orm";
import { PayRateType } from "@/db/enums";
import { companies, companyContractors, equityAllocations, invoices, users } from "@/db/schema";
import { fillDatePicker } from "@test/helpers";

test.describe("invoice creation", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;
  let companyContractor: typeof companyContractors.$inferSelect;
  let projectBasedUser: typeof users.$inferSelect;
  let projectBasedContractor: typeof companyContractors.$inferSelect;

  test.beforeEach(async () => {
    // Create company with equity compensation enabled
    company = (
      await companiesFactory.createCompletedOnboarding({
        equityCompensationEnabled: true,
      })
    ).company;

    // Create contractor user with business info
    contractorUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "22222",
        streetAddress: "1st St.",
      })
    ).user;

    // Create contractor with hourly rate and equity allocation
    companyContractor = (
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: contractorUser.id,
        payRateInSubunits: 6000, // $60/hr
        payRateType: PayRateType.Hourly,
      })
    ).companyContractor;
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 20,
      year: 2023,
    });

    projectBasedUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "33333",
        streetAddress: "2nd Ave.",
      })
    ).user;

    projectBasedContractor = (
      await companyContractorsFactory.createProjectBased({
        companyId: company.id,
        userId: projectBasedUser.id,
        payRateInSubunits: 1_000_00, // $1,000/project
      })
    ).companyContractor;
  });

  test("creates an invoice with an equity component", async ({ page }) => {
    await login(page, contractorUser);
    await page.goto("/invoices/new");

    await page.getByLabel("Hours").fill("3:25");
    await page.getByPlaceholder("Description").fill("I worked on invoices");
    await fillDatePicker(page, "Date", "08/08/2023");

    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).toHaveValue("20");
    await expect(
      page.getByText("By submitting this invoice, your current equity selection will be locked for all 2023."),
    ).toBeVisible();

    await expect(page.getByText("Total services$205")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$41")).toBeVisible();
    await expect(page.getByText("Net amount in cash$164")).toBeVisible();

    await page.getByRole("textbox", { name: "Cash vs equity split" }).fill("50");
    await expect(page.getByText("Total services$205")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$102.50")).toBeVisible();
    await expect(page.getByText("Net amount in cash$102.50")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.locator("tbody")).toContainText(
      [
        "Invoice ID",
        "1",
        "Sent on",
        "Aug 8, 2023",
        "Hours",
        "03:25",
        "Amount",
        "$205",
        "Status",
        "Awaiting approval (0/2)",
      ].join(""),
    );

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice).toBeDefined();
    expect(invoice.totalMinutes).toBe(205);
    expect(invoice.totalAmountInUsdCents).toBe(20500n);
    expect(invoice.cashAmountInCents).toBe(10250n);
    expect(invoice.equityAmountInCents).toBe(10250n);
    expect(invoice.equityPercentage).toBe(50);

    const equityAllocation = await db.query.equityAllocations
      .findFirst({
        where: eq(equityAllocations.companyContractorId, companyContractor.id),
        orderBy: desc(equityAllocations.year),
      })
      .then(takeOrThrow);
    expect(equityAllocation.equityPercentage).toBe(50);
    expect(equityAllocation.locked).toBe(true);
    expect(equityAllocation.status).toBe("pending_grant_creation");
  });

  test("creates an invoice with an equity component for a project-based contractor", async ({ page }) => {
    await login(page, projectBasedUser);
    await page.goto("/invoices/new");

    await page.getByPlaceholder("Description").fill("Website redesign project");
    await page.getByLabel("Amount").fill("1000");
    await fillDatePicker(page, "Date", "08/08/2023");

    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).toHaveValue("0");
    await expect(
      page.getByText("By submitting this invoice, your current equity selection will be locked for all 2023."),
    ).toBeVisible();

    await expect(page.getByText("Total$1,000")).toBeVisible();

    await page.getByRole("textbox", { name: "Cash vs equity split" }).fill("50");
    await expect(page.getByText("Total services$1,000")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$500")).toBeVisible();
    await expect(page.getByText("Net amount in cash$500")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.locator("tbody")).toContainText(
      [
        "Invoice ID",
        "1",
        "Sent on",
        "Aug 8, 2023",
        "Hours",
        "N/A",
        "Amount",
        "$1,000",
        "Status",
        "Awaiting approval (0/2)",
      ].join(""),
    );

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice).toBeDefined();
    expect(invoice.totalAmountInUsdCents).toBe(100000n);
    expect(invoice.cashAmountInCents).toBe(50000n);
    expect(invoice.equityAmountInCents).toBe(50000n);
    expect(invoice.equityPercentage).toBe(50);

    const equityAllocation = await db.query.equityAllocations
      .findFirst({
        where: eq(equityAllocations.companyContractorId, projectBasedContractor.id),
        orderBy: desc(equityAllocations.year),
      })
      .then(takeOrThrow);
    expect(equityAllocation.equityPercentage).toBe(50);
    expect(equityAllocation.locked).toBe(true);
    expect(equityAllocation.status).toBe("pending_grant_creation");
  });

  test("considers the invoice year when calculating equity", async ({ page }) => {
    const companyInvestor = (await companyInvestorsFactory.create({ userId: contractorUser.id, companyId: company.id }))
      .companyInvestor;
    await equityGrantsFactory.createActive(
      {
        companyInvestorId: companyInvestor.id,
        sharePriceUsd: "300",
      },
      { year: 2021 },
    );
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 20,
      year: 2021,
      locked: true,
      status: "approved",
    });

    await login(page, contractorUser);
    await page.goto("/invoices/new");

    await page.getByLabel("Hours").fill("03:25");
    await page.getByPlaceholder("Description").fill("I worked on invoices");
    await fillDatePicker(page, "Date", "08/08/2021");

    await expect(
      page.getByText("By submitting this invoice, your current equity selection will be locked for all 2021."),
    ).not.toBeVisible();

    await expect(page.getByText("Total$205")).toBeVisible();
    await expect(page.getByText("Swapped for equity")).not.toBeVisible();
    await expect(page.getByText("Net amount in cash")).not.toBeVisible();

    await page.getByLabel("Hours").fill("100:00");
    await page.getByPlaceholder("Description").fill("I worked on invoices");

    await expect(page.getByText("Total services$6,000")).toBeVisible();
    await expect(page.getByText("Swapped for equity (not paid in cash)$1,200")).toBeVisible();
    await expect(page.getByText("Net amount in cash$4,800")).toBeVisible();

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.locator("tbody")).toContainText(
      [
        "Invoice ID",
        "1",
        "Sent on",
        "Aug 8, 2021",
        "Hours",
        "100:00",
        "Amount",
        "$6,000",
        "Status",
        "Awaiting approval (0/2)",
      ].join(""),
    );

    const invoice = await db.query.invoices
      .findFirst({
        orderBy: desc(invoices.id),
      })
      .then(takeOrThrow);
    expect(invoice.totalMinutes).toBe(6000);
    expect(invoice.totalAmountInUsdCents).toBe(600000n);
    expect(invoice.cashAmountInCents).toBe(480000n);
    expect(invoice.equityAmountInCents).toBe(120000n);
    expect(invoice.equityPercentage).toBe(20);
  });

  test("allows creation of an invoice as an alumni", async ({ page }) => {
    await db
      .update(companyContractors)
      .set({ startedAt: subDays(new Date(), 365), endedAt: subDays(new Date(), 100) })
      .where(eq(companyContractors.id, companyContractor.id));

    await login(page, contractorUser);
    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("item name");
    await page.getByPlaceholder("HH:MM").fill("01:00");
    await page.getByPlaceholder("Enter notes about your").fill("sent as alumni");
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("cell", { name: "Awaiting approval (0/2)" })).toBeVisible();
  });

  test("does not show equity split if equity compensation is disabled", async ({ page }) => {
    await db.update(companies).set({ equityCompensationEnabled: false }).where(eq(companies.id, company.id));

    await login(page, contractorUser);
    await page.goto("/invoices/new");
    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).not.toBeVisible();
  });
});
