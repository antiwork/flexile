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

    const equityGrantExercise = await equityGrantExercisesFactory.create({ companyInvestorId: companyInvestor.id });

    await login(page, adminUser);
    await page.goto(`/people/${investorUser.externalId}?tab=exercises`);

    await expect(page.locator("tbody")).toContainText(
      [
        "Request date",
        format(equityGrantExercise.requestedAt, "MMM d, yyyy"),
        "Number of shares",
        "100",
        "Cost",
        "$50",
        "Option grant ID",
        "—",
        "Stock certificate ID",
        "—",
        "Status",
        "Signed",
      ].join(""),
    );

    const { equityGrant } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "GUM-1",
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
    const { equityGrant: equityGrant2 } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "GUM-2",
    });
    const shareHolding2 = await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "SH-2",
    });
    await equityGrantExerciseRequestsFactory.create({
      equityGrantId: equityGrant2.id,
      equityGrantExerciseId: equityGrantExercise.id,
      shareHoldingId: shareHolding2.id,
    });
    await page.reload();
    await expect(page.locator("tbody")).toContainText(
      [
        "Request date",
        format(equityGrantExercise.requestedAt, "MMM d, yyyy"),
        "Number of shares",
        "100",
        "Cost",
        "$50",
        "Option grant ID",
        "GUM-1, GUM-2",
        "Stock certificate ID",
        "SH-1, SH-2",
        "Status",
        "Signed",
      ].join(""),
    );
  });
});
