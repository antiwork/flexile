import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { dividendRoundsFactory } from "@test/factories/dividendRounds";
import { dividendsFactory } from "@test/factories/dividends";
import { usersFactory } from "@test/factories/users";
import { wiseRecipientsFactory } from "@test/factories/wiseRecipients";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { companyInvestors, dividends, wiseRecipients } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("Dividends", () => {
  const setup = async () => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user: investorUser } = await usersFactory.create();
    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorUser.id,
      investmentAmountInCents: 100000n,
    });
    const { wiseRecipient } = await wiseRecipientsFactory.create({
      userId: investorUser.id,
      usedForDividends: true,
    });

    const dividendRound = await dividendRoundsFactory.create({
      companyId: company.id,
      releaseDocument:
        "This is a release agreement for <strong>{{investor}}</strong> for the amount of {{amount}}. By signing this document, you agree to the terms and conditions.",
    });

    const dividend = await dividendsFactory.create({
      companyId: company.id,
      companyInvestorId: companyInvestor.id,
      dividendRoundId: dividendRound.id,
      totalAmountInCents: 50000n,
      withheldTaxCents: 5000n,
      numberOfShares: 500n,
      status: "Issued",
    });

    return { company, companyInvestor, investorUser, wiseRecipient, dividendRound, dividend };
  };

  test("allows signing release agreement for dividend", async ({ page }) => {
    const { investorUser, wiseRecipient, dividend } = await setup();

    await login(page, investorUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: "$500" })).toBeVisible();
    await page.getByRole("button", { name: "Sign" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Dividend details" })).toBeVisible();
        await expect(modal.getByText("$500")).toBeVisible();
        await expect(modal.getByText("Cumulative return50%")).toBeVisible();
        await expect(modal.getByText("Taxes withheld$50")).toBeVisible();
        await expect(modal.getByText(`Payout methodAccount ending in ${wiseRecipient.lastFourDigits}`)).toBeVisible();
        await modal.getByRole("button", { name: "Review and sign agreement" }).click();

        await expect(modal.getByRole("heading", { name: "Release agreement" })).toBeVisible();
        await expect(
          modal.getByText(`This is a release agreement for ${investorUser.legalName} for the amount of $500.`),
        ).toBeVisible();
        await expect(modal.getByRole("button", { name: "Accept funds" })).toBeDisabled();
        await modal.getByRole("button", { name: "Add your signature" }).click();
        await expect(modal.getByText(assertDefined(investorUser.legalName))).toHaveCount(2);
        await modal.getByRole("button", { name: "Accept funds" }).click();
      },
      { page },
    );
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Sign" })).not.toBeVisible();

    const updatedDividend = await db.query.dividends
      .findFirst({ where: eq(dividends.id, dividend.id) })
      .then(takeOrThrow);
    expect(updatedDividend.signedReleaseAt).not.toBeNull();
  });

  test("hides the ROI if the investor has no investment amount set", async ({ page }) => {
    const { companyInvestor, investorUser } = await setup();
    await db
      .update(companyInvestors)
      .set({ investmentAmountInCents: 0n })
      .where(eq(companyInvestors.id, companyInvestor.id));

    await login(page, investorUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();
    await page.getByRole("button", { name: "Sign" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Dividend details" })).toBeVisible();
        await expect(modal.getByText("$500")).toBeVisible();
        await expect(modal.getByText("Cumulative return")).not.toBeVisible();
        await modal.getByRole("button", { name: "Review and sign agreement" }).click();
        await modal.getByRole("button", { name: "Add your signature" }).click();
        await modal.getByRole("button", { name: "Accept funds" }).click();
      },
      { page },
    );
    await expect(page.getByRole("button", { name: "Sign" })).not.toBeVisible();
  });

  test("does not allow signing release agreement if the investor has no payout method set up", async ({ page }) => {
    const { investorUser, wiseRecipient } = await setup();
    await db.update(wiseRecipients).set({ usedForDividends: false }).where(eq(wiseRecipients.id, wiseRecipient.id));

    await login(page, investorUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();
    await expect(page.getByRole("button", { name: "Sign" })).not.toBeVisible();
    await expect(page.getByText("Please provide a payout method for your dividends.")).toBeVisible();
  });
});
