import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Company billing settings", () => {
  test("billing settings gated until company name is set", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding(
      {
        name: null,
      },
      { withoutBankAccount: true },
    );

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Billing" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Please provide your company details before linking a bank account." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "provide your company details" })).toHaveAttribute(
      "href",
      "/settings/administrator/details",
    );

    const linkBankAccountButton = page.getByRole("button", { name: "Link your bank account" });
    await expect(linkBankAccountButton).toBeVisible();
    await expect(linkBankAccountButton).toBeDisabled();

    await db.update(companies).set({ name: "Test Company Inc." }).where(eq(companies.id, company.id));
    await page.reload();

    await expect(
      page.getByRole("alert").filter({ hasText: "Please provide your company details before linking a bank account." }),
    ).not.toBeVisible();

    await expect(linkBankAccountButton).toBeVisible();
    await expect(linkBankAccountButton).toBeEnabled();
  });
});
