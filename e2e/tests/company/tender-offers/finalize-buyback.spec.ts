import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { tenderOfferBidsFactory } from "@test/factories/tenderOfferBids";
import { tenderOfferInvestorsFactory } from "@test/factories/tenderOfferInvestors";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { login } from "@test/helpers/auth";
import { formatMoney } from "@test/helpers/money";
import { expect, test, withinModal } from "@test/index";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { companies, companyInvestors, shareClasses, users } from "@/db/schema";

test.describe("Tender offer finalize", () => {
  let company: typeof companies.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let shareClass: typeof shareClasses.$inferSelect;
  let investorUser: typeof users.$inferSelect;

  test.beforeAll(async () => {
    company = (await companiesFactory.create({ tenderOffersEnabled: true, capTableEnabled: true })).company;

    const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
    adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    companyInvestor = (
      await companyInvestorsFactory.create({
        companyId: company.id,
        totalShares: 100000000n,
        investmentAmountInCents: 100000000n,
      })
    ).companyInvestor;

    investorUser = await db.query.users.findFirst({ where: eq(users.id, companyInvestor.userId) }).then(takeOrThrow);

    shareClass = (await shareClassesFactory.create({ companyId: company.id })).shareClass;

    await optionPoolsFactory.create({ companyId: company.id, shareClassId: shareClass.id });

    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "SH-1",
      shareClassId: shareClass.id,
    });
  });

  test("allows admin to finalize single stock repurchase", async ({ page }) => {
    const sharePrice = 15;
    const maxShares = 100;
    const numberOfShares = 10;
    const { tenderOffer } = await tenderOffersFactory.create({
      companyId: company.id,
      name: "Single stock bid test",
      buybackType: "single_stock",
      totalAmountInCents: BigInt(sharePrice * maxShares * 100),
      acceptedPriceCents: sharePrice * 100,
      endsAt: subDays(new Date(), 1),
    });

    await tenderOfferInvestorsFactory.create({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: companyInvestor.id,
    });

    await tenderOfferBidsFactory.create({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: companyInvestor.id,
      numberOfShares: numberOfShares.toString(),
      sharePriceCents: sharePrice * 100,
      acceptedShares: numberOfShares.toString(),
      shareClass: shareClass.name,
    });

    await login(page, adminUser);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("row", { name: /Single stock bid test/u }).click();

    await expect(page).toHaveURL(/\/equity\/buybacks\/.*/u);

    await page.getByRole("button", { name: "Finalize buyback" }).click();

    await withinModal(
      async (modal) => {
        const summarySection = modal.locator('[data-slot="dialog-section"]').nth(0);
        await summarySection.waitFor({ state: "visible" });

        await expect(summarySection.getByText("Single stock repurchase summary")).toBeVisible();
        await expect(summarySection.getByText("Buyback name")).toBeVisible();
        await expect(summarySection.getByText("Single stock bid test")).toBeVisible();
        await expect(summarySection.getByText("Investor", { exact: true })).toBeVisible();
        await expect(
          summarySection.getByText(investorUser.preferredName || investorUser.legalName || investorUser.email),
        ).toBeVisible();
        await expect(summarySection.getByText("Price per share")).toBeVisible();
        await expect(summarySection.getByText(formatMoney(sharePrice), { exact: true })).toBeVisible();
        await expect(summarySection.getByText("Allocation limit")).toBeVisible();
        await expect(summarySection.getByText(`${numberOfShares}`)).toBeVisible();

        await modal.getByRole("button", { name: "Continue" }).click();

        const reviewSection = modal.locator('[data-slot="dialog-section"]').nth(1);
        await reviewSection.waitFor({ state: "visible" });

        await expect(reviewSection.getByText("Review investor's sale")).toBeVisible();
        await expect(reviewSection.getByText("Share class")).toBeVisible();
        await expect(reviewSection.getByText(shareClass.name)).toBeVisible();
        await expect(
          reviewSection.getByText(formatMoney(sharePrice * numberOfShares), { exact: true }).nth(0),
        ).toBeVisible();

        await reviewSection.getByRole("checkbox", { name: /I've reviewed all information/u }).click();
        await reviewSection.getByRole("button", { name: "Confirm and pay" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page, title: "Single stock repurchase summary" },
    );

    await expect(page.getByText("Buyback successfully closed and settled")).toBeVisible();
  });

  test("allows admin to finalize tender offer", async ({ page }) => {
    const minimumValuation = 1000000;
    const numberOfShares = 50;
    const bidPrice = 20;

    const { tenderOffer } = await tenderOffersFactory.create({
      companyId: company.id,
      name: "Tender offer finalize test",
      buybackType: "tender_offer",
      totalAmountInCents: BigInt(minimumValuation * 100),
      minimumValuation: BigInt(minimumValuation),
      acceptedPriceCents: bidPrice * 100,
      endsAt: subDays(new Date(), 1),
    });

    await tenderOfferInvestorsFactory.create({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: companyInvestor.id,
    });

    await tenderOfferBidsFactory.create({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: companyInvestor.id,
      numberOfShares: numberOfShares.toString(),
      sharePriceCents: bidPrice * 100,
      acceptedShares: numberOfShares.toString(),
      shareClass: shareClass.name,
    });

    await login(page, adminUser);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("row", { name: /Tender offer finalize test/u }).click();

    await expect(page).toHaveURL(/\/equity\/buybacks\/.*/u);

    await page.getByRole("button", { name: "Finalize buyback" }).click();

    await withinModal(
      async (modal) => {
        const summarySection = modal.locator('[data-slot="dialog-section"]').nth(0);
        await summarySection.waitFor({ state: "visible" });

        await expect(summarySection.getByText("Tender offer summary")).toBeVisible();
        await expect(summarySection.getByText("Buyback name")).toBeVisible();
        await expect(summarySection.getByText("Tender offer finalize test")).toBeVisible();
        await expect(summarySection.getByText("Clearing price per share")).toBeVisible();
        await expect(summarySection.getByText(formatMoney(bidPrice), { exact: true })).toBeVisible();
        await expect(summarySection.getByText("Accepted shares")).toBeVisible();
        await expect(summarySection.getByText(`${numberOfShares}`)).toBeVisible();
        await expect(summarySection.getByText("Total Payout")).toBeVisible();
        await expect(summarySection.getByText(formatMoney(bidPrice * numberOfShares), { exact: true })).toBeVisible();

        await modal.getByRole("button", { name: "Continue" }).click();

        const reviewSection = modal.locator('[data-slot="dialog-section"]').nth(1);
        await reviewSection.waitFor({ state: "visible" });

        await expect(reviewSection.getByText("Review investors", { exact: true })).toBeVisible();
        await expect(reviewSection.getByText("1 investor", { exact: true })).toBeVisible();
        await expect(reviewSection.getByText("Investor", { exact: true })).toBeVisible();
        await expect(
          reviewSection.getByText(investorUser.preferredName || investorUser.legalName || investorUser.email).nth(0),
        ).toBeVisible();
        await expect(reviewSection.getByText("Shares")).toBeVisible();
        await expect(reviewSection.getByText(`${numberOfShares}`, { exact: true }).nth(0)).toBeVisible();
        await expect(reviewSection.getByText("Total", { exact: true })).toBeVisible();
        await expect(
          reviewSection.getByText(formatMoney(bidPrice * numberOfShares), { exact: true }).nth(0),
        ).toBeVisible();

        await expect(reviewSection.getByText("Total payout")).toBeVisible();

        await modal.getByRole("button", { name: "Continue" }).click();

        const confirmSection = modal.locator('[data-slot="dialog-section"]').nth(2);
        await confirmSection.waitFor({ state: "visible" });

        await expect(confirmSection.getByText("Confirm and process payment")).toBeVisible();
        await expect(confirmSection.getByText("Clearing price per share")).toBeVisible();
        await expect(confirmSection.getByText(formatMoney(bidPrice), { exact: true })).toBeVisible();
        await expect(confirmSection.getByText("Accepted shares")).toBeVisible();
        await expect(confirmSection.getByText(`${numberOfShares}`)).toBeVisible();
        await expect(confirmSection.getByText("Total payout")).toBeVisible();
        await expect(confirmSection.getByText(formatMoney(bidPrice * numberOfShares), { exact: true })).toBeVisible();

        await confirmSection.getByRole("checkbox", { name: /I've reviewed all information/u }).click();
        await confirmSection.getByRole("button", { name: "Finalize buyback" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page, title: "Tender offer summary" },
    );

    await expect(page.getByText("Buyback successfully closed and settled")).toBeVisible();
  });
});
