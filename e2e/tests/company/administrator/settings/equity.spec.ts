import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Company equity settings", () => {
  test("updating company equity settings", async ({ page }) => {
    const { company } = await companiesFactory.create({
      sharePriceInUsd: "20",
      fmvPerShareInUsd: "15.1",
      conversionSharePriceUsd: "18.123456789",
    });
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Equity value" }).click();

    const sharePriceInput = page.getByLabel("Current share price (USD)");
    const valuationPriceInput = page.getByLabel("Current 409A valuation (USD per share)");
    const conversionPriceInput = page.getByLabel("Conversion share price (USD)");

    await expect(sharePriceInput).toHaveValue("20.00");
    await expect(valuationPriceInput).toHaveValue("15.10");
    await expect(conversionPriceInput).toHaveValue("18.123456789");

    await valuationPriceInput.fill("15");
    await expect(valuationPriceInput).toHaveValue("15");
    await valuationPriceInput.blur();
    await expect(valuationPriceInput).toHaveValue("15.00");
    await valuationPriceInput.fill("15.123");
    await expect(valuationPriceInput).toHaveValue("15.123");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();

    expect(
      await db.query.companies.findFirst({
        where: eq(companies.id, company.id),
      }),
    ).toMatchObject({
      sharePriceInUsd: "20",
      fmvPerShareInUsd: "15.123",
      conversionSharePriceUsd: "18.123456789",
    });
  });
});
