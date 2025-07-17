import { clerk } from "@clerk/testing/playwright";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { equityAllocationsFactory } from "@test/factories/equityAllocations";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker, selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, withinModal } from "@test/index";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { companyInvestors, documents, documentSignatures, equityGrants } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("New Contractor", () => {
  test("allows issuing equity grants", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityGrantsEnabled: true,
      equityCompensationEnabled: true,
      conversionSharePriceUsd: "1",
    });
    const { user: contractorUser } = await usersFactory.create();
    let submitters = { "Company Representative": adminUser, Signer: contractorUser };
    const { mockForm } = mockDocuseal(next, { submitters: () => submitters });
    await mockForm(page);
    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await equityAllocationsFactory.create({
      companyContractorId: companyContractor.id,
      equityPercentage: 50,
      locked: true,
    });
    await companyContractorsFactory.createCustom({ companyId: company.id });
    const { user: projectBasedUser } = await usersFactory.create();
    const { companyContractor: projectBasedContractor } = await companyContractorsFactory.createCustom({
      companyId: company.id,
      userId: projectBasedUser.id,
    });
    await equityAllocationsFactory.create({
      companyContractorId: projectBasedContractor.id,
      equityPercentage: 10,
      locked: true,
    });
    await optionPoolsFactory.create({ companyId: company.id });
    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();
    await expect(page.getByRole("link", { name: "New option grant" })).not.toBeVisible();
    await expect(page.getByText("Create equity plan contract templates")).toBeVisible();

    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });
    await page.reload();
    await expect(page.getByText("Create equity plan contract templates")).not.toBeVisible();
    await page.getByRole("link", { name: "New option grant" }).click();
    await expect(page.getByLabel("Number of options")).toHaveValue("10000");
    await selectComboboxOption(page, "Recipient", contractorUser.preferredName ?? "");
    await page.getByLabel("Number of options").fill("10");
    await selectComboboxOption(page, "Relationship to company", "Consultant");
    await page.getByRole("button", { name: "Create option grant" }).click();

    await expect(page.getByRole("table")).toHaveCount(1);
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

    submitters = { "Company Representative": adminUser, Signer: projectBasedUser };
    await page.getByRole("link", { name: "New option grant" }).click();
    await selectComboboxOption(page, "Recipient", projectBasedUser.preferredName ?? "");
    await page.getByLabel("Number of options").fill("20");
    await selectComboboxOption(page, "Relationship to company", "Consultant");
    await page.getByRole("button", { name: "Create option grant" }).click();

    await expect(page.getByRole("table")).toHaveCount(1);
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

    const companyDocuments = await db.query.documents.findMany({ where: eq(documents.companyId, company.id) });
    await db
      .update(documentSignatures)
      .set({ signedAt: new Date() })
      .where(
        inArray(
          documentSignatures.documentId,
          companyDocuments.map((d) => d.id),
        ),
      );
    await clerk.signOut({ page });
    await login(page, contractorUser);
    await page.goto("/invoices");
    await page.getByRole("link", { name: "New invoice" }).first().click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-1");
    await fillDatePicker(page, "Date", "10/15/2024");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByPlaceholder("Description").fill("Software development work");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-1" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Oct 15, 2024");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await clerk.signOut({ page });
    await login(page, projectBasedUser);
    await page.goto("/invoices");
    await page.getByRole("link", { name: "New invoice" }).first().click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-2");
    await fillDatePicker(page, "Date", "11/01/2024");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByPlaceholder("Description").fill("Promotional video production work");
    await page.waitForTimeout(500); // TODO (techdebt): avoid this
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("cell", { name: "CUSTOM-2" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Nov 1, 2024");
    await expect(page.locator("tbody")).toContainText("1,000");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");
  });

  test("allows cancelling a grant", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityGrantsEnabled: true,
      conversionSharePriceUsd: "1",
    });
    const { companyInvestor } = await companyInvestorsFactory.create({ companyId: company.id });
    const { equityGrant } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      vestedShares: 50,
      unvestedShares: 50,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Confirm cancellation" }).click();
      },
      { page },
    );

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).not.toBeVisible();
    expect(
      (await db.query.equityGrants.findFirst({ where: eq(equityGrants.id, equityGrant.id) }).then(takeOrThrow))
        .cancelledAt,
    ).not.toBeNull();
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
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Options" }).click();
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
