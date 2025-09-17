import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Company billing settings", () => {
  test("billing settings gated until company name is set", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding(
      { name: null },
      { withoutBankAccount: true },
    );

    await login(page, adminUser, "/settings/administrator/billing");

    await expect(
      page.getByRole("alert").getByText("Please provide your company details before linking a bank account."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Link your bank account" })).toBeDisabled();
    await page.getByRole("link", { name: "provide your company details" }).click();

    await page.getByLabel("Company's legal name").fill("Test Company Inc.");
    await page.getByLabel("EIN").fill("123456789");
    await page.getByRole("button", { name: "Save changes" }).click();

    await page.getByRole("link", { name: "Billing" }).click();
    await expect(page.getByRole("button", { name: "Link your bank account" })).toBeEnabled();

    await expect(
      page.getByRole("alert").filter({ hasText: "Please provide your company details before linking a bank account." }),
    ).not.toBeVisible();
  });
});
