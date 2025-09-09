import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Company equity settings", () => {
  test("equity settings gated until company name is set", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      name: null,
      sharePriceInUsd: null,
      fmvPerShareInUsd: null,
      conversionSharePriceUsd: null,
      equityEnabled: false,
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Equity" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Please add your company name in order to manage equity settings." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "add your company name" })).toHaveAttribute(
      "href",
      "/settings/administrator/details",
    );

    const enableEquitySwitch = page.getByRole("switch", { name: "Enable equity" });
    await expect(enableEquitySwitch).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Equity value" })).not.toBeVisible();

    await db.update(companies).set({ name: "Test Company Inc." }).where(eq(companies.id, company.id));
    await page.reload();

    await expect(
      page.getByRole("alert").filter({ hasText: "Please add your company name in order to manage equity settings." }),
    ).not.toBeVisible();

    await expect(enableEquitySwitch).toBeEnabled();
    await enableEquitySwitch.click({ force: true });

    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("heading", { name: "Equity value" })).toBeVisible();
  });

  test("enabling and updating company equity settings", async ({ page }) => {
    const { company } = await companiesFactory.create({
      sharePriceInUsd: null,
      fmvPerShareInUsd: null,
      conversionSharePriceUsd: null,
      equityEnabled: false,
      optionExercisingEnabled: false,
    });
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Equity" }).click();

    // Check initial state - exercise requests visible and toggle disabled until equity is enabled
    await expect(page.getByText("Exercise requests")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeDisabled();

    // Enable equity toggle
    const enableEquitySwitch = page.getByRole("switch", { name: "Enable equity" });
    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "false");
    await enableEquitySwitch.waitFor({ state: "visible" });
    await enableEquitySwitch.click({ force: true });
    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "true");

    // Now option exercising toggle should be visible
    const enableOptionExercisingSwitch = page.getByRole("switch", { name: "Enable option exercising" });
    await expect(enableOptionExercisingSwitch).toBeVisible();
    await expect(enableOptionExercisingSwitch).toHaveAttribute("aria-checked", "false");

    // Enable option exercising
    await enableOptionExercisingSwitch.click({ force: true });
    await expect(enableOptionExercisingSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).not.toBeDisabled();

    // Wait for the form to appear
    await expect(page.getByRole("heading", { name: "Equity value" })).toBeVisible();

    const sharePriceInput = page.getByLabel("Current share price (USD)");
    const valuationPriceInput = page.getByLabel("Current 409A valuation (USD per share)");
    const conversionPriceInput = page.getByLabel("Conversion share price (USD)");

    await expect(sharePriceInput).toHaveValue("0.00");
    await expect(valuationPriceInput).toHaveValue("0.00");
    await expect(conversionPriceInput).toHaveValue("0.00");

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
      optionExercisingEnabled: true,
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

  test("option exercising toggle behavior", async ({ page }) => {
    const { company } = await companiesFactory.create({
      equityEnabled: false,
      optionExercisingEnabled: false,
    });
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Equity" }).click();

    // Initially, exercise requests visible and toggle disabled until equity is enabled
    await expect(page.getByText("Exercise requests")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeDisabled();

    // Enable equity first
    const enableEquitySwitch = page.getByRole("switch", { name: "Enable equity" });
    await enableEquitySwitch.click({ force: true });
    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "true");

    // Now option exercising toggle should appear
    const enableOptionExercisingSwitch = page.getByRole("switch", { name: "Enable option exercising" });
    await expect(enableOptionExercisingSwitch).toBeVisible();
    await expect(enableOptionExercisingSwitch).toHaveAttribute("aria-checked", "false");

    // Test toggling option exercising
    await enableOptionExercisingSwitch.click({ force: true });
    await expect(enableOptionExercisingSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeChecked({ checked: true });
    await expect(page.getByText("Exercise notice", { exact: true })).toBeVisible();

    // Verify in database
    let dbCompany = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
    });
    expect(dbCompany?.optionExercisingEnabled).toBe(true);

    // Turn it back off
    await enableOptionExercisingSwitch.click({ force: true });
    await expect(enableOptionExercisingSwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeChecked({ checked: false });
    await expect(page.getByText("Exercise notice", { exact: true })).not.toBeVisible();

    // Verify in database
    dbCompany = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
    });
    expect(dbCompany?.optionExercisingEnabled).toBe(false);

    // Disable equity - option exercising toggle should remain visible but be disabled
    await enableEquitySwitch.click({ force: true });
    await expect(enableEquitySwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Enable option exercising" })).toBeDisabled();
    await expect(page.getByText("Exercise requests")).toBeVisible(); // Text should still be visible
  });
});
