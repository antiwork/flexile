import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { tenderOfferInvestorsFactory } from "@test/factories/tenderOfferInvestors";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, companyInvestors, users } from "@/db/schema";

test.describe("Tender offer place bid", () => {
  let company: typeof companies.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;
  let investorUser: typeof users.$inferSelect;
  test.beforeAll(async () => {
    company = (await companiesFactory.create({ tenderOffersEnabled: true, capTableEnabled: true })).company;
    await companyAdministratorsFactory.create({ companyId: company.id });
    companyInvestor = (
      await companyInvestorsFactory.create({
        companyId: company.id,
        totalShares: 100000000n,
        investmentAmountInCents: 100000000n,
      })
    ).companyInvestor;

    investorUser = await db.query.users.findFirst({ where: eq(users.id, companyInvestor.userId) }).then(takeOrThrow);

    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "SH-1",
    });
  });

  test("allows investor to place bid on single stock repurchase", async ({ page }) => {
    const sharePrice = 15;
    const maxShares = 100;
    const numberOfShares = 10;
    const { tenderOffer } = await tenderOffersFactory.create({
      companyId: company.id,
      name: "Single stock bid test",
      buybackType: "single_stock",
      totalAmountInCents: BigInt(sharePrice * maxShares * 100),
      acceptedPriceCents: sharePrice * 100,
    });

    await tenderOfferInvestorsFactory.create({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: companyInvestor.id,
    });

    await login(page, investorUser);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("row", { name: /Single stock bid test/u }).click();

    await expect(page).toHaveURL(/\/equity\/buybacks\/.*/u);

    await page.getByRole("button", { name: "Place bid" }).click();

    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Continue" }).click();
        await modal.getByRole("button", { name: "Add your signature" }).click();
        await modal.getByRole("checkbox", { name: /I've reviewed the/u }).click();
        await modal.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("combobox", { name: "Share class" }).click();
        await page.getByRole("option").first().click();
        await modal.getByLabel("Number of shares").fill(`${numberOfShares}`);
        await modal.getByRole("button", { name: "Submit bid" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page, title: "Buyback details" },
    );

    await expect(
      page.getByRole("row", {
        name: new RegExp(`${numberOfShares}.*\\$${sharePrice}.*\\$${sharePrice * numberOfShares}`, "u"),
      }),
    ).toBeVisible();
  });

  test("allows investor to place bid on tender offer", async ({ page }) => {
    const minimumValuation = 1000000;
    const numberOfShares = 5;
    const bidPrice = 20;

    const { tenderOffer } = await tenderOffersFactory.create({
      companyId: company.id,
      name: "Tender offer bid test",
      buybackType: "tender_offer",
      totalAmountInCents: BigInt(minimumValuation * 100),
      minimumValuation: BigInt(minimumValuation),
    });

    await tenderOfferInvestorsFactory.create({
      tenderOfferId: tenderOffer.id,
      companyInvestorId: companyInvestor.id,
    });

    await login(page, investorUser);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("row", { name: /Tender offer bid test/u }).click();

    await expect(page).toHaveURL(/\/equity\/buybacks\/.*/u);

    await page.getByRole("button", { name: "Place bid" }).click();

    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Continue" }).click();
        await modal.getByRole("button", { name: "Add your signature" }).click();
        await modal.getByRole("checkbox", { name: /I've reviewed the/u }).click();
        await modal.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("combobox", { name: "Share class" }).click();
        await page.getByRole("option").first().click();
        await modal.getByLabel("Number of shares").fill(`${numberOfShares}`);
        await modal.getByLabel("Price per share").fill(`${bidPrice}`);
        await modal.getByRole("button", { name: "Submit bid" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page, title: "Buyback details" },
    );

    await expect(
      page.getByRole("row", {
        name: new RegExp(`${numberOfShares}.*\\$${bidPrice}.*\\$${bidPrice * numberOfShares}`, "u"),
      }),
    ).toBeVisible();
  });
});
