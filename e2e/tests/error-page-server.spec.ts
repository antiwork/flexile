import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Page not found error page (code 404)", () => {
  test("shows custom 404 when visiting invoice page with non-existent ID", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    // Use a random, non-existent invoice ID
    await login(page, adminUser, `/invoices/doesnotexist`);
    await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
    await expect(
      page.getByText("The thing you were looking for doesn't exist... Sorry!", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home?" })).toBeVisible();
  });
});

test.describe("Access denied error page (code 403)", () => {
  test("shows access denied for user without any roles", async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user, "/settings/tax");
    await expect(page.getByText("Access denied", { exact: true })).toBeVisible();
    await expect(page.getByText("You are not allowed to perform this action.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home?" })).toBeVisible();
  });
});

test.describe("Internal server error page (code 500)", () => {
  test("shows 500 error page when backend returns 500", async ({ page }) => {
    const { user } = await usersFactory.create();
    // Intercept the tRPC invoices.get call and force a 500 error
    await page.route("**/trpc/invoices.get**", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" }),
    );
    // Visit a page that fetches via tRPC
    await login(page, user, "/invoices/anyid");
    await expect(page.getByText("Something went wrong", { exact: true })).toBeVisible();
    await expect(page.getByText("Sorry about that. Please try again!", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home?" })).toBeVisible();
  });
});
