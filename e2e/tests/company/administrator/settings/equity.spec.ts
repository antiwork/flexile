import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Company equity settings", () => {
  test("enabling and updating company equity settings", async ({ page }) => {
    const { company } = await companiesFactory.create({
      sharePriceInUsd: null,
      fmvPerShareInUsd: null,
      conversionSharePriceUsd: null,
      equityEnabled: false,
    });
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Equity" }).click();

    // Enable equity toggle
    const enableEquitySwitch = page.getByRole("switch", { name: "Enable equity" });
    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "false");
    await enableEquitySwitch.waitFor({ state: "visible" });
    await enableEquitySwitch.click({ force: true });
    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "true");

    // Wait for the form to appear
    await expect(page.getByRole("heading", { name: "Equity value" })).toBeVisible();

    const sharePriceInput = page.getByLabel("Current share price (USD)");
    const valuationPriceInput = page.getByLabel("Current 409A valuation (USD per share)");
    const conversionPriceInput = page.getByLabel("Conversion share price (USD)");

    await expect(sharePriceInput).toHaveValue("");
    await expect(valuationPriceInput).toHaveValue("");
    await expect(conversionPriceInput).toHaveValue("");

    await sharePriceInput.fill("20");
    await conversionPriceInput.fill("18.123456789");

    await valuationPriceInput.fill("15");
    await expect(valuationPriceInput).toHaveValue("15");
    await valuationPriceInput.blur();
    await expect(valuationPriceInput).toHaveValue("15.00");
    await valuationPriceInput.fill("15.123");
    await expect(valuationPriceInput).toHaveValue("15.123");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();

    const dbCompany = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
    });
    expect(dbCompany).toMatchObject({
      equityEnabled: true,
      sharePriceInUsd: "20",
      fmvPerShareInUsd: "15.123",
      conversionSharePriceUsd: "18.123456789",
    });

    // Navigate to root page and verify Equity button is visible
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Equity" })).toBeVisible();
    await page.getByRole("button", { name: "Equity" }).click();
    await expect(page.getByRole("link", { name: "Investors" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Option pools" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Equity grants" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dividends" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Buybacks" })).toBeVisible();
  });
});
