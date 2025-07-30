import { companiesFactory } from "@test/factories/companies";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { usersFactory } from "@test/factories/users";
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

  test("contractor is redirected to invoices page", async ({ page }) => {
    const { user } = await usersFactory.createContractor();
    await login(page, user);
    await page.goto("/");
    await page.waitForURL((url) => url.pathname.includes("/invoices"));
    expect(page.url()).toContain("/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("company admin is redirected to invoices page", async ({ page }) => {
    const { user } = await usersFactory.createCompanyAdmin();
    await login(page, user);
    await page.goto("/");
    await page.waitForURL((url) => url.pathname.includes("/invoices"));
    expect(page.url()).toContain("/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("lawyer is redirected to documents page", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();
    await companyLawyersFactory.create({ companyId: company.id, userId: user.id });
    await login(page, user);
    await page.goto("/");
    await page.waitForURL((url) => url.pathname.includes("/documents"));
    expect(page.url()).toContain("/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  });

  test("investor is redirected to first equity page", async ({ page }) => {
    // The redirect for investors depends on company flags and navLinks order.
    // It could be /equity/investors, /equity/options, /equity/shares, /equity/convertibles, or /equity/dividends.
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();
    await companyInvestorsFactory.create({ companyId: company.id, userId: user.id });
    await login(page, user);
    await page.goto("/");
    await page.waitForURL((url) => url.pathname.includes("/equity"));
    expect(page.url()).toContain("/equity/");
  });
});
