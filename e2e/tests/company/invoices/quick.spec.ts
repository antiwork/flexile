import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { companies, companyContractors, invoices, users } from "@/db/schema";
import { fillDatePicker } from "@test/helpers";

test.describe("quick invoicing", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;
  let companyContractor: typeof companyContractors.$inferSelect;

  test.beforeEach(async () => {
    company = (await companiesFactory.createCompletedOnboarding()).company;
    contractorUser = (
      await usersFactory.createWithBusinessEntity({
        zipCode: "22222",
        streetAddress: "1st St.",
      })
    ).user;
    companyContractor = (
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: contractorUser.id,
        payRateInSubunits: 6000,
      })
    ).companyContractor;
  });

  test("allows submitting a quick invoice", async ({ page }) => {
    await login(page, contractorUser);
    await page.getByLabel("Hours / Qty").fill("10:30");
    await expect(page.getByLabel("Rate")).toHaveValue("60");
    await page.getByLabel("Rate").fill("50");
    await expect(page.getByText("Total amount$525")).toBeVisible();
    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByRole("row").getByText("$525")).toBeVisible();

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.totalAmountInUsdCents).toBe(52500n);
  });

  test.describe("when equity compensation is disabled", () => {
    test("allows filling out the form and previewing the invoice", async ({ page }) => {
      await login(page, contractorUser);
      await page.getByLabel("Hours / Qty").fill("10:30");
      await page.getByLabel("Rate").fill("50");
      await fillDatePicker(page, "Date", "08/08/2024");
      await page.getByRole("link", { name: "Add more info" }).click();

      await expect(page.getByRole("group", { name: "Date" })).toHaveText("8/8/2024");
      await expect(page.getByRole("row")).toHaveCount(3); // Line items header + 1 row + footer
      const row = page.getByRole("row").nth(1);
      await expect(row.getByPlaceholder("Description")).toHaveValue("");
      await expect(row.getByLabel("Hours / Qty")).toHaveValue("10:30");
      await expect(page.getByLabel("Rate")).toHaveValue("50");
      await expect(row.getByText("$525")).toBeVisible();
      await expect(page.getByText("Total$525")).toBeVisible();
    });
  });

  test.describe("equity compensation", () => {
    test.beforeEach(async () => {
      await db.update(companies).set({ equityCompensationEnabled: true }).where(eq(companies.id, company.id));
    });

    test("handles equity compensation when allocation is set", async ({ page }) => {
      await equityAllocationsFactory.create({
        companyContractorId: companyContractor.id,
        equityPercentage: 20,
        year: 2024,
      });

      await login(page, contractorUser);
      await page.getByLabel("Hours / Qty").fill("10:30");
      await fillDatePicker(page, "Date", "08/08/2024");
      await page.getByRole("textbox", { name: "Cash vs equity split" }).fill("20");

      await expect(page.getByText("($504 cash + $126 equity)")).toBeVisible();
      await expect(page.getByText("$630", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Send for approval" }).click();

      await expect(page.getByText("Lock 20% in equity for all 2024?")).toBeVisible();
      await expect(
        page.getByText("By submitting this invoice, your current equity selection of 20% will be locked for all 2024"),
      ).toBeVisible();
      await expect(
        page.getByText("You won't be able to choose a different allocation until the next options grant for 2025"),
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirm 20% equity selection" }).click();

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

    test("handles equity compensation when no allocation is set", async ({ page }) => {
      await login(page, contractorUser);
      await page.getByLabel("Hours").fill("10:30");
      await fillDatePicker(page, "Date", "08/08/2024");

      await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).toHaveValue("0");

      await expect(page.getByText("($630 cash + $0 equity)")).toBeVisible();
      await expect(page.getByText("$630", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Send for approval" }).click();

      await expect(page.getByText("Lock 0% in equity for all 2024?")).toBeVisible();
      await expect(
        page.getByText("By submitting this invoice, your current equity selection of 0% will be locked for all 2024"),
      ).toBeVisible();
      await expect(
        page.getByText("You won't be able to choose a different allocation until the next options grant for 2025"),
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirm 0% equity selection" }).click();

      await expect(page.getByRole("cell", { name: "Aug 8, 2024" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "$630" })).toBeVisible();

      const invoice = await db.query.invoices
        .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
        .then(takeOrThrow);
      expect(invoice.totalAmountInUsdCents).toBe(63000n);
      expect(invoice.cashAmountInCents).toBe(63000n);
      expect(invoice.equityAmountInCents).toBe(0n);
      expect(invoice.equityPercentage).toBe(0);
    });
  });
});
