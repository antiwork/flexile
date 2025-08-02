import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantExerciseRequestsFactory } from "@test/factories/equityGrantExerciseRequests";
import { equityGrantExercisesFactory } from "@test/factories/equityGrantExercises";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { format } from "date-fns";

test.describe("People - Exercises Table", () => {
  test("displays option grant IDs and stock certificate IDs in exercises table", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const { user: investorUser } = await usersFactory.create();
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorUser.id,
    });

    await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "GUM-1",
    });

    const equityGrantExercise = await equityGrantExercisesFactory.create({ companyInvestorId: companyInvestor.id });

    const { equityGrant } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "GUM-2",
    });
    const shareHolding = await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "SH-1",
    });
    await equityGrantExerciseRequestsFactory.create({
      equityGrantId: equityGrant.id,
      equityGrantExerciseId: equityGrantExercise.id,
      shareHoldingId: shareHolding.id,
    });
    const { equityGrant: equityGrant3 } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "GUM-3",
    });
    const shareHolding2 = await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "SH-2",
    });
    await equityGrantExerciseRequestsFactory.create({
      equityGrantId: equityGrant3.id,
      equityGrantExerciseId: equityGrantExercise.id,
      shareHoldingId: shareHolding2.id,
    });

    await login(page, adminUser);
    await page.goto(`/people/${investorUser.externalId}`);
    await page.waitForLoadState("networkidle");

    // Go to the exercises tab
    const exercisesTab = page.getByRole("tab", { name: "Exercises" });
    await expect(exercisesTab).toBeVisible();
    await exercisesTab.click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("tbody")).toContainText(
      [
        "Request date",
        format(equityGrantExercise.requestedAt, "MMM d, yyyy"),
        "Number of shares",
        "100",
        "Cost",
        "$50",
        "Option grant ID",
        "GUM-2, GUM-3",
        "Stock certificate ID",
        "SH-1, SH-2",
        "Status",
        "Signed",
      ].join(""),
    );
  });
});
