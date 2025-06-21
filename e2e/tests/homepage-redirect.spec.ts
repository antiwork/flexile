import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Homepage redirect", () => {
  test("unauthenticated user sees marketing homepage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Contractor payments")).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  });

  test("authenticated user is redirected to dashboard", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);
    await page.goto("/");

    await page.waitForURL((url) => url.pathname !== "/");
    expect(page.url()).toContain("/invoices");

    await expect(page.getByText("Contractor payments")).not.toBeVisible();
  });
});
