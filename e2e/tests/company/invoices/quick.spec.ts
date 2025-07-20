import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { companies, invoices, users } from "@/db/schema";

test.describe("quick invoicing", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    company = (await companiesFactory.createCompletedOnboarding()).company;
    contractorUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "22222",
        streetAddress: "1st St.",
      })
    ).user;
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
      payRateInSubunits: 6000,
      equityPercentage: 20,
    });
  });

  test("allows submitting a quick invoice", async ({ page }) => {
    await login(page, contractorUser);
    await page.getByLabel("Hours / Qty").fill("10:30");
    await expect(page.getByLabel("Rate")).toHaveValue("60");
    await page.getByLabel("Rate").fill("50");
    await expect(page.getByText("Total amount$525")).toBeVisible();
    await page.getByRole("button", { name: "Send for approval" }).click();

    await expect(page.getByText("Lock 0% in equity for all 2025?")).toBeVisible();
    await expect(
      page.getByText("By submitting this invoice, your current equity selection of 0% will be locked for all 2025"),
    ).toBeVisible();
    await expect(
      page.getByText("You won't be able to choose a different allocation until the next options grant for 2026"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm 0% equity selection" }).click();
    await expect(page.getByRole("row").getByText("$525")).toBeVisible();

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.totalAmountInUsdCents).toBe(52500n);
  });

  test("handles equity compensation", async ({ page }) => {
    const companyInvestor = (await companyInvestorsFactory.create({ userId: contractorUser.id, companyId: company.id }))
      .companyInvestor;
    await equityGrantsFactory.createActive(
      { companyInvestorId: companyInvestor.id, sharePriceUsd: "100" },
      { year: 2024 },
    );
    await login(page, contractorUser);
    await page.getByLabel("Hours / Qty").fill("10:30");
    await fillDatePicker(page, "Date", "08/08/2024");

    await expect(page.getByText("($504 cash + $126 equity)")).toBeVisible();
    await expect(page.getByText("$630", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Send for approval" }).click();

    await expect(page.getByRole("cell", { name: "Aug 8, 2024" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$630" })).toBeVisible();

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.totalAmountInUsdCents).toBe(63000n);
    expect(invoice.cashAmountInCents).toBe(50400n);
    expect(invoice.equityAmountInCents).toBe(12600n);
    expect(invoice.equityPercentage).toBe(20);
  });
});
