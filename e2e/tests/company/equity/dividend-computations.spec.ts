import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendRoundsFactory } from "@test/factories/dividendRounds";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { dividendComputations } from "@/db/schema";

test.describe("Dividend Computations", () => {
  const setup = async () => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: investorUser1 } = await usersFactory.create();
    const { user: investorUser2 } = await usersFactory.create();

    const { companyInvestor: investor1 } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorUser1.id,
      investmentAmountInCents: 100000n,
    });

    const { companyInvestor: investor2 } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorUser2.id,
      investmentAmountInCents: 200000n,
    });

    const { shareClass } = await shareClassesFactory.create({
      companyId: company.id,
      name: "Common",
      originalIssuePriceInDollars: "10.00",
    });

    await shareHoldingsFactory.create({
      companyInvestorId: investor1.id,
      shareClassId: shareClass.id,
      numberOfShares: 1000,
      totalAmountInCents: 10000n,
      sharePriceUsd: "10.00",
    });

    await shareHoldingsFactory.create({
      companyInvestorId: investor2.id,
      shareClassId: shareClass.id,
      numberOfShares: 2000,
      totalAmountInCents: 20000n,
      sharePriceUsd: "10.00",
    });

    await dividendRoundsFactory.create({
      companyId: company.id,
      totalAmountInCents: 50000n,
      numberOfShares: 1500n,
      numberOfShareholders: 2n,
      status: "Issued",
      returnOfCapital: false,
      readyForPayment: false,
    });

    return { company, adminUser, investor1, investor2, shareClass };
  };

  test("creates dividend computation", async ({ page }) => {
    const { company, adminUser } = await setup();

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    await expect(page.getByRole("button", { name: "New distribution" })).toBeVisible();
    await page.getByRole("button", { name: "New distribution" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Start a new distribution" })).toBeVisible();
        await modal.getByLabel("Total distribution amount").fill("50000");
        await fillDatePicker(page, "Payment date", "12/25/2024");
        await expect(modal.getByText("Start a new distribution")).toBeVisible();
        await modal.getByRole("button", { name: "Create distribution" }).click();
      },
      { page },
    );

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Draft")).toBeVisible();
    await expect(page.getByText("50,000")).toBeVisible();
    await expect(page.getByText("Dec 25, 2024")).toBeVisible();

    const computation = await db.query.dividendComputations
      .findFirst({ where: eq(dividendComputations.companyId, company.id) })
      .then(takeOrThrow);

    expect(computation.totalAmountInUsd).toBe("50000.0");
    expect(computation.returnOfCapital).toBe(false);
    expect(computation.dividendsIssuanceDate).toBe("2024-12-25");
  });
});
