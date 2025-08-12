import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker, selectComboboxOption } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, withinModal } from "@test/index";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { companyInvestors, documents, documentSignatures, equityGrants } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("Equity Grants", () => {
  test("allows issuing equity grants", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "1",
      conversionSharePriceUsd: "1.00", // Set conversion share price
      sharePriceInUsd: "1.00", // Set share price to match FMV
    });
    const { user: contractorUser } = await usersFactory.create();
    let submitters = { "Company Representative": adminUser, Signer: contractorUser };
    const { mockForm } = mockDocuseal(next, { submitters: () => submitters });
    await mockForm(page);
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await companyContractorsFactory.createCustom({ companyId: company.id });
    const { user: projectBasedUser } = await usersFactory.create();
    await companyContractorsFactory.createCustom({
      companyId: company.id,
      userId: projectBasedUser.id,
    });
    await optionPoolsFactory.create({ companyId: company.id });
    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();

    // Initially, without document templates, the "New option grant" button should not be visible
    // and the alert about creating templates should be shown
    await expect(page.getByRole("button", { name: "New option grant" })).not.toBeVisible();
    await expect(page.getByText("Create equity plan contract templates")).toBeVisible();

    // Create the required document template
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });
    await page.reload();

    // After creating the template, the alert should disappear and the button should be visible
    await expect(page.getByText("Create equity plan contract templates")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "New option grant" })).toBeVisible();
    await page.getByRole("button", { name: "New option grant" }).click();
    await expect(page.getByLabel("Number of options")).toHaveValue("10000");
    await selectComboboxOption(page, "Recipient", contractorUser.preferredName ?? "");
    await page.getByLabel("Number of options").fill("10");
    await selectComboboxOption(page, "Relationship to company", "Consultant");

    // Fill in required grant type
    await selectComboboxOption(page, "Grant type", "NSO");

    // Fill in required vesting details
    await selectComboboxOption(page, "Shares will vest", "As invoices are paid");

    // Fill in required board approval date (using today's date)
    await fillDatePicker(page, "Board approval date", new Date().toLocaleDateString("en-US"));

    // Fill in required exercise period fields
    await page.getByRole("button", { name: "Customize post-termination exercise period" }).click();

    // Use more precise selectors focusing on the input fields directly
    await page.locator('input[name="voluntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="involuntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="terminationWithCauseExerciseMonths"]').fill("3");
    await page.locator('input[name="deathExerciseMonths"]').fill("12");
    await page.locator('input[name="disabilityExerciseMonths"]').fill("12");
    await page.locator('input[name="retirementExerciseMonths"]').fill("12");

    await expect(page.getByRole("button", { name: "Create grant" })).toBeEnabled();

    await page.getByRole("button", { name: "Create grant" }).click();

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
    await page.getByRole("button", { name: "New option grant" }).click();

    // Fill in recipient (required)
    await selectComboboxOption(page, "Recipient", projectBasedUser.preferredName ?? "");

    // Fill in number of options (required)
    await page.getByLabel("Number of options").fill("20");

    // Fill in relationship to company (required)
    await selectComboboxOption(page, "Relationship to company", "Consultant");

    // Fill in required grant type
    await selectComboboxOption(page, "Grant type", "NSO");

    // Fill in required vesting details
    await selectComboboxOption(page, "Shares will vest", "As invoices are paid");

    // Fill in required board approval date (using today's date)
    await fillDatePicker(page, "Board approval date", new Date().toLocaleDateString("en-US"));

    // Fill in required exercise period fields
    await page.getByRole("button", { name: "Customize post-termination exercise period" }).click();

    // Use more precise selectors focusing on the input fields directly
    await page.locator('input[name="voluntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="involuntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="terminationWithCauseExerciseMonths"]').fill("3");
    await page.locator('input[name="deathExerciseMonths"]').fill("12");
    await page.locator('input[name="disabilityExerciseMonths"]').fill("12");
    await page.locator('input[name="retirementExerciseMonths"]').fill("12");

    // All required fields are filled:
    await expect(page.getByRole("button", { name: "Create grant" })).toBeEnabled();

    await page.getByRole("button", { name: "Create grant" }).click();

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
    await logout(page);
    await login(page, contractorUser, "/invoices");
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

    await logout(page);
    await login(page, projectBasedUser, "/invoices");
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
      equityEnabled: true,
      fmvPerShareInUsd: "1",
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
      equityEnabled: true,
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
        await expect(modal.getByText("Exercise cost$50")).toBeVisible(); // 10 * $5 (exercise price)
        // Option value $1000 = 10 * $100 (option value)
        // Option value diff 1,900% = 1000 / 50 - 1 = 19x
        await expect(modal.getByText("Options valueBased on 2M valuation$1,0001,900%")).toBeVisible();

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

  test("modal functionality for creating equity grants", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "1",
      conversionSharePriceUsd: "1.00", // Set conversion share price
      sharePriceInUsd: "1.00", // Set share price to match FMV
    });
    const { user: contractorUser } = await usersFactory.create();
    const submitters = { "Company Representative": adminUser, Signer: contractorUser };
    const { mockForm } = mockDocuseal(next, { submitters: () => submitters });
    await mockForm(page);
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await optionPoolsFactory.create({
      companyId: company.id,
      authorizedShares: 20000n, // Ensure enough shares in the pool
      issuedShares: 0n, // No shares issued yet
    });
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();

    // Test modal opens when clicking "New option grant" button
    await page.getByRole("button", { name: "New option grant" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("New equity grant")).toBeVisible();

    // Test form validation - button should be disabled initially
    await expect(page.getByRole("button", { name: "Create grant" })).toBeDisabled();

    // Test form fields are present
    await expect(page.getByLabel("Recipient")).toBeVisible();
    await expect(page.getByLabel("Option pool")).toBeVisible();
    await expect(page.getByLabel("Number of options")).toBeVisible();
    await expect(page.getByLabel("Relationship to company")).toBeVisible();

    // Test estimated value calculation using FMV share price from database
    await page.getByLabel("Number of options").fill("1000");
    await expect(page.getByText("Estimated value: $1000.00, based on a $1")).toBeVisible();

    // Test with different number of shares to verify calculation accuracy
    await page.getByLabel("Number of options").fill("2500");
    await expect(page.getByText("Estimated value: $2500.00, based on a $1")).toBeVisible();

    // Test with larger number to verify calculation scales correctly
    await page.getByLabel("Number of options").fill("10000");
    await expect(page.getByText("Estimated value: $10000.00, based on a $1")).toBeVisible();

    // Test form completion enables submit button only after filling in all required fields
    await selectComboboxOption(page, "Recipient", contractorUser.preferredName ?? "");
    await selectComboboxOption(page, "Relationship to company", "Consultant");

    // Fill in required grant type
    await selectComboboxOption(page, "Grant type", "NSO");

    // Fill in required vesting details
    await selectComboboxOption(page, "Shares will vest", "As invoices are paid");

    // Fill in required board approval date (using today's date)
    await fillDatePicker(page, "Board approval date", new Date().toLocaleDateString("en-US"));

    // Fill in required exercise period fields
    await page.getByRole("button", { name: "Customize post-termination exercise period" }).click();
    await page.locator('input[name="voluntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="involuntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="terminationWithCauseExerciseMonths"]').fill("3");
    await page.locator('input[name="deathExerciseMonths"]').fill("12");
    await page.locator('input[name="disabilityExerciseMonths"]').fill("12");
    await page.locator('input[name="retirementExerciseMonths"]').fill("12");

    // Now verify the button is enabled
    await expect(page.getByRole("button", { name: "Create grant" })).toBeEnabled();

    // Test modal closes after successful submission
    await page.getByRole("button", { name: "Create grant" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Test new grant appears in the table
    await expect(page.getByRole("table")).toHaveCount(1);
    const rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(2);
    const row = rows.nth(1);
    await expect(row).toContainText(contractorUser.legalName ?? "");
    await expect(row).toContainText("10,000");
  });

  test("uses correct FMV share price for estimated value", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "2.50", // Set a specific FMV share price
      conversionSharePriceUsd: "1.00", // Set conversion share price
      sharePriceInUsd: "2.50", // Set share price to match FMV
    });
    const { user: contractorUser } = await usersFactory.create();
    const submitters = { "Company Representative": adminUser, Signer: contractorUser };
    const { mockForm } = mockDocuseal(next, { submitters: () => submitters });
    await mockForm(page);
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await optionPoolsFactory.create({
      companyId: company.id,
      authorizedShares: 20000n, // Ensure enough shares in the pool
      issuedShares: 0n, // No shares issued yet
    });
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();

    // Open the modal
    await page.getByRole("button", { name: "New option grant" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Test estimated value calculation with $2.50 FMV share price
    await page.getByLabel("Number of options").fill("1000");
    await expect(page.getByText("Estimated value: $2500.00, based on a $2.5")).toBeVisible();

    // Test with different number of shares
    await page.getByLabel("Number of options").fill("500");
    await expect(page.getByText("Estimated value: $1250.00, based on a $2.5")).toBeVisible();

    // Test with larger number
    await page.getByLabel("Number of options").fill("10000");
    await expect(page.getByText("Estimated value: $25000.00, based on a $2.5")).toBeVisible();
  });

  test("handles missing FMV share price gracefully", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: null,
      conversionSharePriceUsd: "1.00", // Still need conversion price for the form to work
      sharePriceInUsd: null, // Also set share price to null since we're testing missing price scenario
    });
    const { user: contractorUser } = await usersFactory.create();
    const submitters = { "Company Representative": adminUser, Signer: contractorUser };
    const { mockForm } = mockDocuseal(next, { submitters: () => submitters });
    await mockForm(page);
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await optionPoolsFactory.create({
      companyId: company.id,
      authorizedShares: 20000n, // Ensure enough shares in the pool
      issuedShares: 0n, // No shares issued yet
    });
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();

    // Open the modal
    await page.getByRole("button", { name: "New option grant" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Test that estimated value is not shown when FMV share price is missing
    await page.getByLabel("Number of options").fill("1000");
    await expect(page.getByText("Estimated value:")).not.toBeVisible();
  });
});
