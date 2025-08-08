import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker, selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test } from "@test/index";
import { addMonths, format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { equityGrants, vestingEvents, vestingSchedules } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe.configure({ mode: "serial" });

test.describe("Equity Grant Vesting Events", () => {
  test("displays vesting events in the equity grant details modal", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "1",
      conversionSharePriceUsd: "1.00",
      sharePriceInUsd: "1.00",
    });

    const { user: contractorUser } = await usersFactory.create();
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": adminUser, Signer: contractorUser }),
    });
    await mockForm(page);

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    const { optionPool } = await optionPoolsFactory.create({
      companyId: company.id,
      authorizedShares: 100000n,
      issuedShares: 0n,
    });

    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });

    // Create a vesting schedule (4 year vesting with 1 year cliff, monthly vesting)
    let vestingSchedule = await db.query.vestingSchedules.findFirst({
      where: and(
        eq(vestingSchedules.totalVestingDurationMonths, 48),
        eq(vestingSchedules.cliffDurationMonths, 12),
        eq(vestingSchedules.vestingFrequencyMonths, 1),
      ),
    });

    if (!vestingSchedule) {
      [vestingSchedule] = await db
        .insert(vestingSchedules)
        .values({
          totalVestingDurationMonths: 48, // 4 years
          cliffDurationMonths: 12, // 1 year cliff
          vestingFrequencyMonths: 1, // monthly vesting
        })
        .returning();
    }

    // Create investor record
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    // Create equity grant with vesting schedule
    const vestingStartDate = new Date();
    const { equityGrant } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      optionPoolId: optionPool.id,
      numberOfShares: 48000, // 48,000 shares total
      vestedShares: 0,
      unvestedShares: 48000,
      exercisedShares: 0,
      forfeitedShares: 0,
      exercisePriceUsd: "1.00",
      sharePriceUsd: "1.00",
      optionGrantType: "nso",
      vestingTrigger: "scheduled",
      vestingScheduleId: assertDefined(vestingSchedule).id,
      issuedAt: vestingStartDate,
      acceptedAt: vestingStartDate,
      periodStartedAt: vestingStartDate,
      periodEndedAt: addMonths(vestingStartDate, 48),
      expiresAt: addMonths(vestingStartDate, 120), // 10 year expiry
      boardApprovalDate: vestingStartDate.toDateString(),
      voluntaryTerminationExerciseMonths: 3,
      involuntaryTerminationExerciseMonths: 3,
      terminationWithCauseExerciseMonths: 0,
      deathExerciseMonths: 12,
      disabilityExerciseMonths: 12,
      retirementExerciseMonths: 12,
      optionHolderName: contractorUser.legalName ?? "",
      issueDateRelationship: "employee",
    });

    // Create vesting events based on the schedule
    // First year cliff: 12,000 shares vest at month 12
    await db.insert(vestingEvents).values({
      equityGrantId: equityGrant.id,
      vestingDate: addMonths(vestingStartDate, 12),
      vestedShares: 12000n, // 25% cliff
    });

    // Monthly vesting for remaining 36 months: 1,000 shares per month
    for (let month = 13; month <= 48; month++) {
      await db.insert(vestingEvents).values({
        equityGrantId: equityGrant.id,
        vestingDate: addMonths(vestingStartDate, month),
        vestedShares: 1000n, // 1,000 shares per month
      });
    }

    // Mark first few vesting events as processed (vested)
    const allVestingEvents = await db.query.vestingEvents.findMany({
      where: eq(vestingEvents.equityGrantId, equityGrant.id),
      orderBy: (vestingEvents, { asc }) => [asc(vestingEvents.vestingDate)],
    });

    // Process the cliff and first 3 months of monthly vesting
    for (let i = 0; i < 4 && i < allVestingEvents.length; i++) {
      await db
        .update(vestingEvents)
        .set({ processedAt: new Date() })
        .where(eq(vestingEvents.id, assertDefined(allVestingEvents[i]).id));
    }

    // Add some non-processed vesting events (should not show in modal)
    await db.insert(vestingEvents).values([
      {
        equityGrantId: equityGrant.id,
        vestingDate: addMonths(vestingStartDate, 49), // Future event - not processed
        vestedShares: 1000n,
      },
      {
        equityGrantId: equityGrant.id,
        vestingDate: addMonths(vestingStartDate, 50), // Future event - not processed
        vestedShares: 1000n,
      },
    ]);

    // Add some cancelled vesting events (should not show in modal)
    await db.insert(vestingEvents).values([
      {
        equityGrantId: equityGrant.id,
        vestingDate: addMonths(vestingStartDate, 17),
        vestedShares: 1000n,
        processedAt: new Date(),
        cancelledAt: new Date(),
      },
      {
        equityGrantId: equityGrant.id,
        vestingDate: addMonths(vestingStartDate, 18),
        vestedShares: 1000n,
        processedAt: new Date(),
        cancelledAt: new Date(),
      },
    ]);

    // Update the equity grant's vested shares count
    await db
      .update(equityGrants)
      .set({
        vestedShares: 15000, // 12,000 (cliff) + 3,000 (3 months)
        unvestedShares: 33000, // 48,000 - 15,000
      })
      .where(eq(equityGrants.id, equityGrant.id));

    await login(page, adminUser);

    // Navigate to the people page and find the contractor
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractorUser.preferredName ?? "" }).click();

    // Click on the Options tab
    await page.getByRole("tab", { name: "Options" }).click();

    // The grant should appear in the options table
    await expect(page.getByRole("table")).toHaveCount(1);
    const rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(2);
    const row = rows.nth(1);
    await expect(row).toContainText("48,000");

    // Click on the row to open the details modal
    await row.click();

    // Wait for the modal to open and vesting events to load
    await expect(page.getByRole("dialog")).toBeVisible();

    await expect(page.getByText("Vesting events")).toBeVisible({ timeout: 10000 });

    // Verify vesting events section shows up
    const vestingEventsSection = page.getByRole("dialog");

    // Check cliff vesting event (12,000 shares at month 12)
    const cliffDate = format(addMonths(vestingStartDate, 12), "MMM d, yyyy");
    await expect(vestingEventsSection).toContainText(cliffDate);
    await expect(vestingEventsSection).toContainText("12,000 shares");

    // Check monthly vesting events
    for (let month = 13; month <= 15; month++) {
      const vestingDate = format(addMonths(vestingStartDate, month), "MMM d, yyyy");
      await expect(vestingEventsSection).toContainText(vestingDate);
      await expect(vestingEventsSection).toContainText("1,000 shares");
    }

    // Verify only 4 processed events are shown (cliff + 3 monthly) and no cancelled events
    const sharesEntries = await vestingEventsSection.getByText(/\d+,?\d*\s+shares/u, { exact: false }).count();
    expect(sharesEntries).toBe(4); // Only processed events should be visible

    // Should not show status indicators like (Vested) or (Scheduled)
    const statusCount = await vestingEventsSection
      .getByText(/\((Vested|Scheduled|Cancelled)\)/u, { exact: false })
      .count();
    expect(statusCount).toBe(0);

    // Verify other sections are still present within the modal
    const modalContent = page.getByRole("dialog");
    await expect(modalContent.getByText("Total options granted")).toBeVisible();
    await expect(modalContent.getByText("48,000 (NSO)")).toBeVisible();
    await expect(modalContent.getByText("Vested").first()).toBeVisible();
    await expect(modalContent.getByText("15,000").first()).toBeVisible();
    await expect(modalContent.getByText("Unvested").first()).toBeVisible();
    await expect(modalContent.getByText("33,000").first()).toBeVisible();
  });

  test("handles equity grants with invoice-based vesting", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "1",
      conversionSharePriceUsd: "1.00",
      sharePriceInUsd: "1.00",
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
      authorizedShares: 50000n,
      issuedShares: 0n,
    });
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();

    // Create grant with invoice-based vesting
    await page.getByRole("button", { name: "New option grant" }).click();
    await selectComboboxOption(page, "Recipient", contractorUser.preferredName ?? "");
    await page.getByLabel("Number of options").fill("10000");
    await selectComboboxOption(page, "Relationship to company", "Consultant");
    await selectComboboxOption(page, "Grant type", "NSO");
    await selectComboboxOption(page, "Shares will vest", "As invoices are paid");
    await fillDatePicker(page, "Board approval date", new Date().toLocaleDateString("en-US"));

    // Fill exercise periods
    await page.getByRole("button", { name: "Customize post-termination exercise period" }).click();
    await page.locator('input[name="voluntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="involuntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="terminationWithCauseExerciseMonths"]').fill("0");
    await page.locator('input[name="deathExerciseMonths"]').fill("12");
    await page.locator('input[name="disabilityExerciseMonths"]').fill("12");
    await page.locator('input[name="retirementExerciseMonths"]').fill("12");

    await page.getByRole("button", { name: "Create grant" }).click();

    // Navigate to the people page and find the contractor
    await page.getByRole("link", { name: "People" }).click();

    await page.getByRole("link", { name: contractorUser.preferredName ?? "" }).click();

    // Click on the Options tab
    await page.getByRole("tab", { name: "Options" }).click();

    // Open the details modal by clicking on the grant row
    await page.getByRole("table").first().getByRole("row").nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Invoice-based vesting grants should not show vesting events section within the modal
    const modalContent = page.getByRole("dialog");
    await expect(modalContent.getByText("Vesting events")).not.toBeVisible();

    // But should show other standard sections within the modal
    await expect(modalContent.getByText("Total options granted")).toBeVisible();
    await expect(modalContent.getByText("10,000 (NSO)")).toBeVisible();
    await expect(modalContent.getByText("Exercise details")).toBeVisible();
    await expect(modalContent.getByText("Post-termination exercise windows")).toBeVisible();
    await expect(modalContent.getByText("Compliance details")).toBeVisible();
  });
});
