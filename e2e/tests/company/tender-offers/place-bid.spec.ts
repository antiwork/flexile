import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { tenderOffersFactory } from "@test/factories/tenderOffers";
import { login } from "@test/helpers/auth";
import { formatMoney } from "@test/helpers/money";
import { expect, test, withinModal } from "@test/index";
import { addDays, format } from "date-fns";
import { eq } from "drizzle-orm";
import { companies, companyInvestors, users } from "@/db/schema";

test.describe("Tender offer place bid", () => {
  let company: typeof companies.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;
  let investorUser: typeof users.$inferSelect;
  test.beforeAll(async () => {
    company = (await companiesFactory.create({ equityEnabled: true })).company;
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

  test("allows investor to place bid on tender offer", async ({ page }) => {
    const minimumValuation = 1000000;
    const numberOfShares = 50;
    const bidPrice = 20;
    const startDate = new Date();
    const endDate = addDays(new Date(), 30);
    const letterOfTransmittal = faker.lorem.paragraphs();

    await tenderOffersFactory.create({
      companyId: company.id,
      totalAmountInCents: BigInt(minimumValuation * 100),
      minimumValuation: BigInt(minimumValuation),
      startsAt: startDate,
      endsAt: endDate,
      letterOfTransmittal,
    });

    await login(page, investorUser, "/equity/tender_offers");

    const row = page.getByRole("row", {
      name: new RegExp(`${format(startDate, "MMM d, yyyy")}.*${format(endDate, "MMM d, yyyy")}.*\\$1,000,000`, "u"),
    });

    await row.getByRole("button", { name: "Place bid" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByText("Buyback details")).toBeVisible();
        await expect(modal.getByText("Start date")).toBeVisible();
        await expect(modal.getByText("End date")).toBeVisible();
        await expect(modal.getByText("Starting valuation")).toBeVisible();
        await expect(modal.getByText(formatMoney(minimumValuation))).toBeVisible();
        await expect(modal.getByText("Starting price per share")).toBeVisible();

        await modal.getByRole("button", { name: "Continue" }).click();
      },
      { page, title: "Buyback details" },
    );

    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Letter of Transmittal" }).click();
        await expect(modal.getByRole("article", { name: "Letter of transmittal" })).toContainText(letterOfTransmittal, {
          useInnerText: true,
        });
        await modal.getByRole("button", { name: "Add your signature" }).click();
        await modal.getByRole("checkbox", { name: /I've reviewed the/u }).click();
        await modal.getByRole("button", { name: "Continue" }).click();
      },
      { page, title: "Letter of transmittal" },
    );

    await withinModal(
      async (modal) => {
        await page.getByRole("combobox", { name: "Share class" }).click();
        await page.getByRole("option").first().click();
        await modal.getByLabel("Number of shares").fill(`${numberOfShares}`);
        await modal.getByLabel("Price per share").fill(`${bidPrice}`);
        await modal.getByRole("button", { name: "Submit bid" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page, title: "Place a bid" },
    );

    await row.click();

    await expect(
      page.getByRole("row", {
        name: new RegExp(`${numberOfShares}.*\\$${bidPrice}`, "u"),
      }),
    ).toBeVisible();
  });
});
