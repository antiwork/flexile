import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Homepage redirect", () => {
  test("unauthenticated user sees marketing homepage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Contractor payments")).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    expect(page.url()).toBe("https://test.flexile.dev:3101/");
  });

  test("authenticated user is redirected to dashboard", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);
    await page.goto("/");

    await page.waitForURL((url) => url.pathname !== "/");
    expect(page.url()).not.toContain("test.flexile.dev:3101/");

    await expect(page.getByText("Contractor payments")).not.toBeVisible();
  });
});
