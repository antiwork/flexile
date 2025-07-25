import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { addDays, formatDate } from "date-fns";
import { eq } from "drizzle-orm";
import { companies, companyInvestors, users } from "@/db/schema";

test.describe("Buyback creation", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;

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

    await shareHoldingsFactory.create({
      companyInvestorId: companyInvestor.id,
      name: "SH-1",
    });
  });

  test("allows creating a new tender offer buyback", async ({ page }) => {
    const startDate = addDays(new Date(), 1);
    const endDate = addDays(new Date(), 30);

    await login(page, adminUser);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("button", { name: "New buyback" }).click();

    await withinModal(
      async (modal) => {
        await modal.getByLabel("Buyback name").fill("Tender offer buyback");
        await fillDatePicker(page, "Start date", startDate.toLocaleDateString());
        await fillDatePicker(page, "End date", endDate.toLocaleDateString());
        await modal.getByLabel("Starting valuation").fill("100000000");
        await modal.getByLabel("Target buyback value").fill("5000000");
        await modal.locator('input[name="attachment"]').setInputFiles("e2e/samples/sample.zip");

        await modal.getByRole("button", { name: "Continue" }).click();
        await modal
          .getByPlaceholder("Paste https://...")
          .fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");

        await modal.getByRole("button", { name: "Continue" }).click();

        await modal.getByRole("button", { name: "Create buyback" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page },
    );

    await expect(
      page.getByRole("row", {
        name: new RegExp(
          `Tender offer buyback.*${formatDate(endDate, "MMM d, yyyy")}.*\\$100,000,000.*Open|Closed|Reviewing`,
          "u",
        ),
      }),
    ).toBeVisible();
  });

  test("allows creating a single stock repurchase", async ({ page }) => {
    const startDate = addDays(new Date(), 1);
    const endDate = addDays(new Date(), 30);

    await login(page, adminUser);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("button", { name: "New buyback" }).click();

    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Single stock repurchase" }).click();

        await modal.getByLabel("Buyback name").fill("Single stock repurchase test");

        await modal.getByRole("combobox", { name: "Investor" }).click();
        await modal.getByRole("option").first().click();

        await fillDatePicker(page, "Start date", startDate.toLocaleDateString());
        await fillDatePicker(page, "End date", endDate.toLocaleDateString());

        await modal.getByLabel("Price per share").fill("10.50");
        await modal.getByLabel("Target buyback value").fill("1000000");
        await modal.locator('input[name="attachment"]').setInputFiles("e2e/samples/sample.zip");

        await modal.getByRole("button", { name: "Continue" }).click();

        await modal
          .getByPlaceholder("Paste https://...")
          .fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");

        await modal.getByRole("button", { name: "Create buyback" }).click();

        await modal.waitFor({ state: "detached" });
      },
      { page },
    );

    await expect(
      page.getByRole("row", {
        name: new RegExp(
          `Single stock repurchase test.*${formatDate(endDate, "MMM d, yyyy")}.*Open|Closed|Reviewing`,
          "u",
        ),
      }),
    ).toBeVisible();
  });
});
