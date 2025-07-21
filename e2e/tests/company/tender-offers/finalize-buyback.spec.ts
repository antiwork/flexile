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
import { expect, test, withinModal } from "@test/index";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { companies, companyInvestors, shareClasses, users } from "@/db/schema";

test.describe("Tender offer finalize", () => {
  let company: typeof companies.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let shareClass: typeof shareClasses.$inferSelect;

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
        await modal.getByRole("button", { name: "Continue" }).click();
        await modal.getByRole("checkbox", { name: /I've reviewed all information/u }).click();
        await modal.getByRole("button", { name: "Confirm and pay" }).click();
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
        await modal.getByRole("button", { name: "Continue" }).click();
        await modal.getByRole("button", { name: "Continue" }).click();
        await modal.getByRole("checkbox", { name: /I've reviewed all information/u }).click();
        await modal.getByRole("button", { name: "Finalize buyback" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page, title: "Tender offer summary" },
    );

    await expect(page.getByText("Buyback successfully closed and settled")).toBeVisible();
  });
});
