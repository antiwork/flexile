import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { PayRateType } from "@/db/enums";
import { companies, companyContractors, invoices, users } from "@/db/schema";

test.describe("quick invoicing", () => {
  let company: typeof companies.$inferSelect;
  let contractorUser: typeof users.$inferSelect;
  let companyContractor: typeof companyContractors.$inferSelect;

  test.beforeEach(async ({ page }) => {
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

    await login(page, contractorUser);
  });

  test.describe("when equity compensation is disabled", () => {
    test("allows filling out the form and previewing the invoice for hourly rate", async ({ page }) => {
      await page.getByLabel("Hours").fill("10:30");
      await page.getByLabel("Date").fill("2024-08-08");
      await expect(page.getByText("Total to invoice$630")).toBeVisible();
      await page.getByRole("link", { name: "Preview" }).click();

      await expect(page.getByLabel("Date")).toHaveValue("2024-08-08");
      await expect(page.getByRole("row")).toHaveCount(3); // Header + 1 row + footer
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

      await page.reload();

      await page.getByLabel("Amount").fill("630");
      await page.getByLabel("Date").fill("2024-08-08");
      await expect(page.getByText("Total to invoice$630")).toBeVisible();
      await page.getByRole("link", { name: "Preview" }).click();

      await expect(page.getByLabel("Date")).toHaveValue("2024-08-08");
      await expect(page.getByRole("row")).toHaveCount(3); // Header + 1 row + footer
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
        equityPercentage: 32,
        year: 2024,
      });

      await page.getByLabel("Hours").fill("10:30");
      await page.getByLabel("Date").fill("2024-08-08");

      await expect(page.getByText("Total invoice amount: $630")).toBeVisible();
      await expect(page.getByText("Swapped for equity (not paid in cash): $201.60")).toBeVisible();
      await expect(page.getByText("Net amount in cash$428.40")).toBeVisible();

      await page.getByRole("button", { name: "Send for approval" }).click();

      await expect(page.getByText("Lock 32% in equity for all 2024?")).toBeVisible();
      await expect(
        page.getByText("By submitting this invoice, your current equity selection of 32% will be locked for all 2024"),
      ).toBeVisible();
      await expect(
        page.getByText("You won't be able to choose a different allocation until the next options grant for 2025"),
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirm 32% equity selection" }).click();

      await expect(page.getByRole("cell", { name: "Aug 8, 2024" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "$630" })).toBeVisible();

      const invoice = await db.query.invoices
        .findFirst({
          orderBy: desc(invoices.id),
        })
        .then(takeOrThrow);
      expect(invoice.totalMinutes).toBe(630);
      expect(invoice.totalAmountInUsdCents).toBe(63000n);
      expect(invoice.cashAmountInCents).toBe(42840n);
      expect(invoice.equityAmountInCents).toBe(20160n);
      expect(invoice.equityPercentage).toBe(32);
    });

    test("handles equity compensation when no allocation is set", async ({ page }) => {
      await page.getByLabel("Hours").fill("10:30");
      await page.getByLabel("Date").fill("2024-08-08");

      await expect(page.getByText("Total invoice amount")).not.toBeVisible();
      await expect(page.getByText("Net amount in cash")).not.toBeVisible();
      await expect(page.getByText("Swapped for equity")).not.toBeVisible();
      await expect(page.getByText("Total to invoice$630")).toBeVisible();

      await page.getByRole("button", { name: "Send for approval" }).click();

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
