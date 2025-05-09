import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { PayRateType } from "@/db/enums";

test.describe("Invoice equity percentage with locked allocations", () => {
  test("sets default invoice equity percentage based on locked allocation", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityCompensationEnabled: true,
    });

    const { user } = await usersFactory.create();

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
      payRateInSubunits: 5000, // $50/hr
      payRateType: PayRateType.Hourly,
    });

    const currentYear = new Date().getFullYear();
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 30,
      year: currentYear,
      locked: true,
      status: "approved",
    });

    await login(page, user);

    await page.goto("/invoices/new");

    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).toHaveValue("30");

    await expect(page.getByRole("textbox", { name: "Cash vs equity split" })).toBeDisabled();

    await page.getByLabel("Hours").fill("2:00");
    await page.getByLabel("Date").fill(`${currentYear}-05-01`);
    await page.getByPlaceholder("Description").fill("Test work");

    const totalsLocator = page.locator("footer > div:last-child");
    await expect(totalsLocator).toContainText("Total services$100");
    await expect(totalsLocator).toContainText("Swapped for equity (not paid in cash)$30");
    await expect(totalsLocator).toContainText("Net amount in cash$70");

    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.locator("tbody")).toContainText("Awaiting approval");
  });
});
