import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Impersonation", () => {
  test("admin can impersonate a worker", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const { user: worker } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: worker.id });
    await login(page, adminUser, `/people/${worker.externalId}`);
    await page.getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Impersonate" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).toBeVisible();
    await expect(page.getByText(worker.email)).toBeVisible();
    await page.getByRole("button", { name: "Stop impersonating" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
    await expect(page.getByText(adminUser.email)).toBeVisible();
  });

  test("workers cannot impersonate", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const { user: worker } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: worker.id });
    await login(page, worker, `/people/${adminUser.externalId}`);
    await page.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Impersonate" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
  });

  test("redirects back to original account when impersonation expires", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const { user: worker } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: worker.id });
    await login(page, adminUser, `/people/${worker.externalId}`);
    await page.getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Impersonate" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).toBeVisible();
    await expect(page.getByText(worker.email)).toBeVisible();
    await page.route("**/internal/**", (route) => route.fulfill({ status: 401, body: "Unauthorized" }));
    await page.goto("/invoices");
    await page.waitForURL(/\/impersonate\?actor_token=null/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await page.unroute("**/internal/**");
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
    await expect(page.getByText(adminUser.email)).toBeVisible();
  });
});
