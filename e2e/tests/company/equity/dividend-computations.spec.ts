import { getLocalTimeZone, today } from "@internationalized/date";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { dividendComputationsFactory } from "@test/factories/dividendComputations";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { dividendComputations } from "@/db/schema";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
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

    await expect(page).toHaveURL(/\/equity\/dividend_rounds\/draft\/.+/u);
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
      { page, assertClosed: false },
    );
  });

  test("admin can successfully finalize distribution", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const dividendComputation = await dividendComputationsFactory.create({
      companyId: company.id,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    const draftRow = page
      .getByRole("row")
      .filter({
        has: page.getByText("Draft"),
      })
      .filter({
        has: page.getByText(formatMoney(dividendComputation.totalAmountInUsd)),
      });

    await expect(draftRow).toBeVisible();
    await draftRow.click();

    await expect(page.getByRole("heading", { name: "Dividend" })).toBeVisible();
    await expect(page.getByText("Dividend distribution is still a draft")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalize distribution" })).toBeVisible();
    const footerBeforeFinalization = await page.locator("tfoot").textContent();
    await page.getByRole("button", { name: "Finalize distribution" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Distribution details" })).toBeVisible();
        await expect(modal.getByText("Please confirm all details are accurate")).toBeVisible();
        await expect(modal.getByText("Dividends")).toBeVisible();
        const totalCostRow = modal.getByText("Total cost:").locator("..");
        await expect(
          totalCostRow.getByText(
            formatMoneyFromCents(
              Number(dividendComputation.totalAmountInUsd) * 100 + dividendComputation.totalFeesCents,
            ),
          ),
        ).toBeVisible();
        await modal.getByLabel("I've reviewed all information and confirm it's correct.").click();
        await expect(modal.getByRole("button", { name: "Finalize distribution" })).toBeEnabled();
        await modal.getByRole("button", { name: "Finalize distribution" }).click();
      },
      { page },
    );

    await expect(page).toHaveURL(/\/equity\/dividend_rounds\/round\/.+/u);

    const footerAfterFinalization = await page.locator("tfoot").textContent();
    expect(footerAfterFinalization).toBe(footerBeforeFinalization);

    await page.getByRole("link", { name: "Dividends" }).first().click();
    await expect(draftRow).not.toBeVisible();

    const issuedRow = page
      .getByRole("row")
      .filter({
        has: page.getByText("Issued"),
      })
      .filter({
        has: page.getByText(formatMoney(dividendComputation.totalAmountInUsd)),
      });

    await expect(issuedRow).toBeVisible();

    // Going back to an already finalized dividend computation should redirect to not found
    await page.goto(`/equity/dividend_rounds/draft/${dividendComputation.externalId}`);
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("lawyer cannot finalize distribution - read-only access", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: lawyerUser } = await usersFactory.create();
    await companyLawyersFactory.create({
      companyId: company.id,
      userId: lawyerUser.id,
    });

    const dividendComputation = await dividendComputationsFactory.create({
      companyId: company.id,
    });

    await login(page, lawyerUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    const draftRow = page
      .getByRole("row")
      .filter({
        has: page.getByText("Draft"),
      })
      .filter({
        has: page.getByText(formatMoney(dividendComputation.totalAmountInUsd)),
      });

    await expect(draftRow).toBeVisible();
    await draftRow.click();

    await expect(page.getByRole("heading", { name: "Dividend" })).toBeVisible();
    await expect(page.getByText("Dividend distribution is still a draft")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalize distribution" })).not.toBeVisible();
  });

  test("displays computation table data correctly", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: lawyerUser } = await usersFactory.create();
    await companyLawyersFactory.create({
      companyId: company.id,
      userId: lawyerUser.id,
    });

    const dividendComputation = await dividendComputationsFactory.create({
      companyId: company.id,
    });

    await login(page, lawyerUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Dividends" }).first().click();

    const draftRow = page
      .getByRole("row")
      .filter({
        has: page.getByText("Draft"),
      })
      .filter({
        has: page.getByText(formatMoney(dividendComputation.totalAmountInUsd)),
      });

    await expect(draftRow).toBeVisible();
    await draftRow.click();

    const table = page.locator("table");
    await expect(table).toBeVisible();

    const row1 = page
      .getByRole("row")
      .filter({
        has: page.getByText("$1,000"),
      })
      .filter({
        has: page.getByText("$20,000"),
      });
    const row2 = page
      .getByRole("row")
      .filter({
        has: page.getByText("$2,000"),
      })
      .filter({
        has: page.getByText("$40,000"),
      });
    const tableFooter = page.locator("tfoot");

    await expect(row1).toBeVisible();
    await expect(row2).toBeVisible();
    await expect(tableFooter).toBeVisible();
    await expect(tableFooter).toContainText("$3,000");
    await expect(tableFooter).toContainText("$60,000");
  });
});
