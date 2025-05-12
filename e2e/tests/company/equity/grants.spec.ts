import { clerk } from "@clerk/testing/playwright";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption, fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, withinModal } from "@test/index";
import { and, desc, eq } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { companyInvestors, equityGrants } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("New Contractor", () => {
  test("allows issuing equity grants", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityGrantsEnabled: true,
      conversionSharePriceUsd: "1",
    });
    const { user: contractorUser } = await usersFactory.create();
    const submitters = { "Company Representative": adminUser, Signer: contractorUser };
    const { mockForm } = mockDocuseal(next, { submitters: () => submitters });
    await mockForm(page);
    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 50,
      status: "pending_grant_creation",
      locked: true,
    });
    await companyContractorsFactory.createProjectBased({ companyId: company.id });
    const { user: projectBasedUser } = await usersFactory.create();
    const { companyContractor: projectBasedContractor } = await companyContractorsFactory.createProjectBased({
      companyId: company.id,
      userId: projectBasedUser.id,
    });
    await equityAllocationsFactory.create({
      companyContractorId: projectBasedContractor.id,
      equityPercentage: 10,
      status: "pending_grant_creation",
      locked: true,
    });
    await optionPoolsFactory.create({ companyId: company.id });
    await login(page, adminUser);
    await page.getByRole("link", { name: "Equity" }).click();
    await page.getByRole("tab", { name: "Equity grants" }).click();
    await expect(page.getByRole("link", { name: "New option grant" })).not.toBeVisible();
    await expect(page.getByText("Create equity plan contract and board consent templates")).toBeVisible();

    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.BoardConsent,
    });
    await page.reload();
    await expect(page.getByText("Create equity plan contract and board consent templates")).not.toBeVisible();
    await page.getByRole("link", { name: "New option grant" }).click();
    await expect(page.getByLabel("Number of options")).toHaveValue("10000");
    await selectComboboxOption(page, "Recipient", contractorUser.preferredName ?? "");
    await page.getByLabel("Number of options").fill("10");
    await selectComboboxOption(page, "Relationship to company", "Consultant");
    await page.getByRole("button", { name: "Create option grant" }).click();

    await expect(page.getByRole("table")).toHaveCount(2);
    let rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(2);
    let row = rows.nth(1);
    await expect(row).toContainText(contractorUser.legalName ?? "");
    await expect(row).toContainText("10");
    const companyInvestor = await db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, contractorUser.id)),
    });
    assertDefined(
      await db.query.equityGrants.findFirst({
        where: eq(equityGrants.companyInvestorId, assertDefined(companyInvestor).id),
        orderBy: desc(equityGrants.createdAt),
      }),
    );

    await page.getByRole("link", { name: "New option grant" }).click();
    await selectComboboxOption(page, "Recipient", projectBasedUser.preferredName ?? "");
    await page.getByLabel("Number of options").fill("20");
    await selectComboboxOption(page, "Relationship to company", "Consultant");
    await page.getByRole("button", { name: "Create option grant" }).click();

    await expect(page.getByRole("table")).toHaveCount(2);
    rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(3);
    row = rows.nth(1);
    await expect(row).toContainText(projectBasedUser.legalName ?? "");
    await expect(row).toContainText("20");
    const projectBasedCompanyInvestor = await db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, projectBasedUser.id)),
    });
    assertDefined(
      await db.query.equityGrants.findFirst({
        where: eq(equityGrants.companyInvestorId, assertDefined(projectBasedCompanyInvestor).id),
        orderBy: desc(equityGrants.createdAt),
      }),
    );

    await clerk.signOut({ page });
    await login(page, contractorUser);
    await page.goto("/invoices");
    await page.getByRole("link", { name: "New invoice" }).first().click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-1");
    await fillDatePicker(page, "Date", "10/15/2024");
    await page.getByPlaceholder("HH:MM").first().fill("05:30");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByPlaceholder("Description").fill("Software development work");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-1" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Oct 15, 2024");
    await expect(page.locator("tbody")).toContainText("05:30");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await clerk.signOut({ page });
    await login(page, projectBasedUser);
    await page.goto("/invoices");
    await page.getByRole("link", { name: "New invoice" }).first().click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-2");
    await fillDatePicker(page, "Date", "11/01/2024");
    await page.getByLabel("Amount").fill("1000");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByPlaceholder("Description").fill("Promotional video production work");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-2" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Nov 1, 2024");
    await expect(page.locator("tbody")).toContainText("1,000");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");
  });

  test("allows exercising options", async ({ page, next }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityGrantsEnabled: true,
      conversionSharePriceUsd: "1",
      jsonData: { flags: ["option_exercising"] },
    });
    const { user } = await usersFactory.create();
    const { mockForm } = mockDocuseal(next, {});
    await mockForm(page);
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });
    const { companyInvestor } = await companyInvestorsFactory.create({ companyId: company.id, userId: user.id });
    await equityGrantsFactory.create({ companyInvestorId: companyInvestor.id, vestedShares: 100 });

    await login(page, user);
    await page.getByRole("link", { name: "Equity" }).click();
    await page.getByRole("tab", { name: "Options" }).click();
    await expect(page.getByText("You have 100 vested options available for exercise.")).toBeVisible();
    await page.getByRole("button", { name: "Exercise Options" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByLabel("Options to exercise").fill("10");
        await expect(modal.getByText("Exercise cost$50")).toBeVisible();
        await expect(modal.getByText("Options valueBased on 2M valuation$1,000")).toBeVisible();
        await modal.getByRole("button", { name: "Proceed" }).click();
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Sign and complete" }).click();
      },
      { page },
    );
    await expect(page.getByText("We're awaiting a payment of $50 to exercise 10 options.")).toBeVisible();
  });
});
