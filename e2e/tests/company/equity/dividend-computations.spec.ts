import { getLocalTimeZone, today } from "@internationalized/date";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { dividendComputationsFactory } from "@test/factories/dividendComputations";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { dividendComputations } from "@/db/schema";
import { formatDate } from "@/utils/time";

test.describe("Dividend Computations", () => {
  test("creates dividend computation", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });
    await dividendComputationsFactory.setupInvestorsWithShareHoldings(company.id);
    const date = today(getLocalTimeZone()).add({ days: 15 });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    await expect(page.getByRole("button", { name: "New distribution" })).toBeVisible();
    await page.getByRole("button", { name: "New distribution" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Start a new distribution" })).toBeVisible();
        await modal.getByLabel("Total distribution amount").fill("50000");
        await fillDatePicker(page, "Payment date", format(date.toString(), "MM/dd/yyyy"));
        await expect(modal.getByText("Start a new distribution")).toBeVisible();
        await modal.getByRole("button", { name: "Create distribution" }).click();
      },
      { page },
    );

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/equity\/dividend_rounds\/draft\/\d+/u);
    await expect(page.getByRole("heading", { name: "Dividend" })).toBeVisible();
    await expect(page.getByText("Dividend distribution is still a draft")).toBeVisible();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    const draftRow = page
      .getByRole("row")
      .filter({
        has: page.getByText("Draft"),
      })
      .filter({
        has: page.getByText("50,000"),
      })
      .filter({
        has: page.getByText(formatDate(date.toString())),
      });

    await expect(draftRow).toBeVisible();

    const computation = await db.query.dividendComputations
      .findFirst({ where: eq(dividendComputations.companyId, company.id) })
      .then(takeOrThrow);

    expect(computation.totalAmountInUsd).toBe("50000.0");
    expect(computation.returnOfCapital).toBe(false);
    expect(computation.dividendsIssuanceDate).toBe(date.toString());
  });

  test("prevents creating dividend computation with date less than 10 days in future", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });
    const date = today(getLocalTimeZone()).add({ days: 5 });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    await expect(page.getByRole("button", { name: "New distribution" })).toBeVisible();
    await page.getByRole("button", { name: "New distribution" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Start a new distribution" })).toBeVisible();
        await modal.getByLabel("Total distribution amount").fill("50000");
        await fillDatePicker(page, "Payment date", format(date.toString(), "MM/dd/yyyy"));
        await expect(modal.getByText("Payment date must be at least 10 days in the future")).toBeVisible();
        await expect(modal.getByRole("button", { name: "Create distribution" })).toBeDisabled();
      },
      { page },
    );
  });
});
