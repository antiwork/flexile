import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { PayRateType } from "@/db/enums";
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
        payRateInSubunits: 6000, // $60/hr
        payRateType: PayRateType.Hourly,
      })
    ).companyContractor;
  });

  test.describe("when equity compensation is disabled", () => {
    test("allows filling out the form and previewing the invoice for hourly rate", async ({ page }) => {
      await login(page, contractorUser);
      await page.getByLabel("Hours worked").fill("10:30");
      await fillDatePicker(page, "Date", "08/08/2024");
      await expect(page.getByText("Total amount$630")).toBeVisible();
      await page.getByRole("link", { name: "Add more info" }).click();

      await expect(page.getByRole("group", { name: "Date" })).toHaveText("8/8/2024");
      await expect(page.getByRole("row")).toHaveCount(5); // Line items header + 1 row + footer + Expenses header + footer
      const row = page.getByRole("row").nth(1);
      await expect(row.getByPlaceholder("Description")).toHaveValue("");
      await expect(row.getByLabel("Hours")).toHaveValue("10:30");
      await expect(row.getByText("$60 / hour")).toBeVisible();
      await expect(row.getByText("$630")).toBeVisible();
      await expect(page.getByText("Total$630")).toBeVisible();
    });

    test("allows filling out the form and previewing the invoice for project-based rate", async ({ page }) => {
      await db
        .update(companyContractors)
        .set({ payRateType: PayRateType.ProjectBased })
        .where(eq(companyContractors.id, companyContractor.id));

      await login(page, contractorUser);

      await page.getByLabel("Amount").fill("630");
      await fillDatePicker(page, "Date", "08/08/2024");
      await expect(page.getByText("Total amount$630")).toBeVisible();
      await page.getByRole("link", { name: "Add more info" }).click();

      await expect(page.getByRole("group", { name: "Date" })).toHaveText("8/8/2024");
      await expect(page.getByRole("row")).toHaveCount(5); // Line items header + 1 row + footer + Expenses header + footer
      const row = page.getByRole("row").nth(1);
      await expect(row.getByPlaceholder("Description")).toHaveValue("");
      await expect(row.getByLabel("Amount")).toHaveValue("630");
      await expect(page.getByText("Total$630")).toBeVisible();
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
      await page.getByLabel("Hours worked").fill("10:30");
      await fillDatePicker(page, "Date", "08/08/2024");
      await page.getByRole("textbox", { name: "Cash vs equity split" }).fill("20");

      await expect(page.getByText("Cash amount$48 / hourly")).toBeVisible();
      await expect(page.getByText("Equity value$12 / hourly")).toBeVisible();
      await expect(page.getByText("Total rate$60 / hourly")).toBeVisible();
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
        .findFirst({
          orderBy: desc(invoices.id),
        })
        .then(takeOrThrow);
      expect(invoice.totalMinutes).toBe(630);
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

      await expect(page.getByText("Cash amount$60 / hourly")).toBeVisible();
      await expect(page.getByText("Equity value$0 / hourly")).toBeVisible();
      await expect(page.getByText("Total rate$60 / hourly")).toBeVisible();
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
        .findFirst({
          orderBy: desc(invoices.id),
        })
        .then(takeOrThrow);
      expect(invoice.totalMinutes).toBe(630);
      expect(invoice.totalAmountInUsdCents).toBe(63000n);
      expect(invoice.cashAmountInCents).toBe(63000n);
      expect(invoice.equityAmountInCents).toBe(0n);
      expect(invoice.equityPercentage).toBe(0);
    });
  });
});
