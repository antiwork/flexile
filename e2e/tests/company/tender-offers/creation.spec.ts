import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { addDays, format, getDate, getMonth } from "date-fns";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Buyback creation", () => {
  test("allows creating a new buyback", async ({ page }) => {
    const today = new Date();
    const endDate = addDays(today, 30);

    const startDay = getDate(today);
    const endDay = getDate(endDate);

    const startMonth = getMonth(today);
    const endMonth = getMonth(endDate);
    const isDifferentMonth = startMonth !== endMonth;
    const endMonthName = format(endDate, "MMMM");

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
    await page.getByRole("dialog").getByText(String(startDay), { exact: true }).click();

    await page.getByLabel("End date").locator("..").getByRole("button").click();
    const calendarDialog = page.getByRole("dialog");

    if (isDifferentMonth) {
      await calendarDialog.locator("header").getByRole("button", { name: "Next" }).click();
      await expect(calendarDialog.getByRole("heading", { name: new RegExp(endMonthName, "u") })).toBeVisible();
    }

    const targetText = calendarDialog.getByText(String(endDay), { exact: true });
    await targetText.click();

    await page.getByLabel("Starting valuation").fill("100000000");
    await page.getByLabel("Document package").setInputFiles("e2e/samples/sample.zip");

    await page.getByRole("button", { name: "Create buyback" }).click();
    await expect(page).toHaveURL(/.*\/equity\/tender_offers$/u);

    const row = page.locator("tr").filter({ hasText: "$100,000,000" });

    await expect(row.getByText(String(startDay), { exact: true })).toBeVisible();
    await expect(row.getByText(String(endDay), { exact: true })).toBeVisible();
    await expect(row.getByText(/\$100,000,000/u)).toBeVisible();
  });
});
