import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Buyback creation", () => {
  test("allows creating a new buyback", async ({ page }) => {
    const { company } = await companiesFactory.create({
      tenderOffersEnabled: true,
      capTableEnabled: true,
    });

    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const user = await db.query.users
      .findFirst({
        where: eq(users.id, administrator.userId),
      })
      .then(takeOrThrow);

    await login(page, user);

    await page.getByRole("link", { name: "Equity" }).click();
    await page.getByRole("tab", { name: "Buybacks" }).click();
    await page.getByRole("link", { name: "New buyback" }).click();

    await page.getByLabel("Start date").locator("..").getByRole("button").click();
    await page.getByRole("gridcell", { name: "10" }).first().click();

    await page.getByLabel("End date").locator("..").getByRole("button").click();
    await page.getByRole("gridcell", { name: "20" }).first().click();

    await page.getByLabel("Starting valuation").fill("100000000");
    await page.getByLabel("Document package").setInputFiles("e2e/samples/sample.zip");

    await page.getByRole("button", { name: "Create buyback" }).click();
    await expect(page).toHaveURL(/.*\/equity\/tender_offers$/u);

    await expect(
      page.getByRole("row", {
        name: /.*10,.*20,.*\$100,000,000/u,
      }),
    ).toBeVisible();
  });
});
