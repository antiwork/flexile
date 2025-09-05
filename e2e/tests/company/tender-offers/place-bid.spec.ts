import { tenderOfferScenarioBuilder } from "@test/builders/tenderOfferScenarios";
import { db, takeOrThrow } from "@test/db";
import { login } from "@test/helpers/auth";
import { navigateToTenderOffers, openTenderOfferDetails } from "@test/helpers/tenderOffers";
import { expect, test } from "@test/index";
import { assertDefined } from "@/utils/assert";

test.describe.configure({ mode: "serial" });
test.describe("Tender Offer Bid Placement", () => {
  test("investor can place a bid on an active tender offer", async ({ page }) => {
    const scenario = await tenderOfferScenarioBuilder.createBasicScenario();
    const investorUser = assertDefined(scenario.investorUsers[0]);

    await login(page, investorUser);
    await navigateToTenderOffers(page);
    await openTenderOfferDetails(page, scenario.tenderOffer.externalId);

    await page.getByRole("button", { name: "Add your signature" }).click();

    await page.getByLabel("Share class").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Number of shares").fill("100");
    await page.getByLabel("Price per share").fill("45");

    await expect(page.getByText("Total amount: $4,500")).toBeVisible();

    await page.getByRole("button", { name: "Submit bid" }).click();

    await expect(page.getByRole("cell", { name: "100" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$45" })).toBeVisible();
  });

  test("investor cannot place bid on expired tender offer", async ({ page }) => {
    const scenario = await tenderOfferScenarioBuilder.createExpiredTenderOfferScenario();
    const investorUser = assertDefined(scenario.investorUsers[0]);

    await login(page, investorUser);
    await navigateToTenderOffers(page);

    await openTenderOfferDetails(page, scenario.tenderOffer.externalId);

    await expect(page.getByRole("button", { name: "Submit bid" })).not.toBeVisible();
  });

  test("investor can view existing bids", async ({ page }) => {
    const scenario = await tenderOfferScenarioBuilder.createScenarioWithExistingBids();
    const investorUser = assertDefined(scenario.investorUsers[0]);

    await login(page, investorUser);
    await navigateToTenderOffers(page);
    await openTenderOfferDetails(page, scenario.tenderOffer.externalId);

    const investor = await db.query.companyInvestors
      .findFirst({
        where: (ci, { and, eq }) => and(eq(ci.companyId, scenario.company.id), eq(ci.userId, investorUser.id)),
      })
      .then(takeOrThrow);

    const bid = await db.query.tenderOfferBids
      .findFirst({
        where: (tob, { and, eq }) =>
          and(eq(tob.tenderOfferId, scenario.tenderOffer.id), eq(tob.companyInvestorId, investor.id)),
      })
      .then(takeOrThrow);

    await expect(page.getByRole("cell", { name: bid.numberOfShares.toString() })).toBeVisible();
    await expect(page.getByRole("cell", { name: `$${bid.sharePriceCents / 100}` })).toBeVisible();
  });

  test("investor cannot exceed available shares", async ({ page }) => {
    const scenario = await tenderOfferScenarioBuilder.createBasicScenario();
    const investorUser = assertDefined(scenario.investorUsers[0]);

    const investor = await db.query.companyInvestors
      .findFirst({
        where: (ci, { and, eq }) => and(eq(ci.companyId, scenario.company.id), eq(ci.userId, investorUser.id)),
      })
      .then(takeOrThrow);

    const holdings = await db.query.shareHoldings.findFirst({
      where: (sh, { eq }) => eq(sh.companyInvestorId, investor.id),
    });

    await login(page, investorUser);
    await navigateToTenderOffers(page);
    await openTenderOfferDetails(page, scenario.tenderOffer.externalId);

    await page.getByRole("button", { name: "Add your signature" }).click();

    await page.getByLabel("Share class").click();
    await page.getByRole("option").first().click();
    const excessiveShares = String(Number(holdings?.numberOfShares || 0) + 1000);
    await page.getByLabel("Number of shares").fill(excessiveShares);
    await page.getByLabel("Price per share").fill("45");

    await page.getByRole("button", { name: "Submit bid" }).click();
    await expect(page.getByText(/Number of shares must be between/iu)).toBeVisible();
  });
});
