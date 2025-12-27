import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { integrationsFactory } from "@test/factories/integrations";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq, isNull } from "drizzle-orm";
import { companies, integrations, type users } from "@/db/schema";

test.describe("GitHub Integrations", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding();
    company = result.company;
    adminUser = result.adminUser;
  });

  test("displays integrations page for admin users", async ({ page }) => {
    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Integrations" }).click();

    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Connect your company's tools to streamline your workflow.")).toBeVisible();
    await expect(page.getByText("GitHub")).toBeVisible();
    await expect(page.getByText("Connect your GitHub organization to verify pull requests in invoices.")).toBeVisible();
  });

  test("allows connecting a GitHub organization", async ({ page }) => {
    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Integrations" }).click();

    // Click connect button
    await page.getByRole("button", { name: "Connect" }).click();

    // Dialog should appear
    await expect(page.getByRole("heading", { name: "Connect GitHub organization" })).toBeVisible();
    await expect(
      page.getByText("Enter your GitHub organization name to enable pull request verification for invoices."),
    ).toBeVisible();

    // Enter organization name
    await page.getByLabel("Organization name").fill("antiwork");

    // Verify the preview text updates
    await expect(page.getByText("github.com/antiwork")).toBeVisible();

    // Click connect
    await page.getByRole("button", { name: "Connect" }).click();

    // Wait for success - the dialog should close and the organization should be displayed
    await expect(page.getByRole("heading", { name: "Connect GitHub organization" })).not.toBeVisible();

    // Verify the integration was created in the database
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.companyId, company.id),
        eq(integrations.type, "github"),
        isNull(integrations.deletedAt),
      ),
    });

    expect(integration).toBeDefined();
    expect(integration?.accountId).toBe("antiwork");
    expect(integration?.status).toBe("active");
  });

  test("shows connected organization when already connected", async ({ page }) => {
    // Create a GitHub integration for the company
    await integrationsFactory.createGitHubIntegration(company.id, "test-organization");

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Integrations" }).click();

    // Should show the connected organization
    await expect(page.getByText("test-organization")).toBeVisible();
    await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  });

  test("allows disconnecting a GitHub organization", async ({ page }) => {
    // Create a GitHub integration for the company
    await integrationsFactory.createGitHubIntegration(company.id, "test-organization");

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Integrations" }).click();

    // Click disconnect button
    await page.getByRole("button", { name: "Disconnect" }).click();

    // Confirmation dialog should appear
    await expect(page.getByRole("heading", { name: "Disconnect GitHub" })).toBeVisible();
    await expect(
      page.getByText(
        "Are you sure you want to disconnect your GitHub organization? This will disable pull request verification for invoices.",
      ),
    ).toBeVisible();

    // Confirm disconnect
    await page.getByRole("button", { name: "Disconnect" }).click();

    // Wait for the dialog to close
    await expect(page.getByRole("heading", { name: "Disconnect GitHub" })).not.toBeVisible();

    // Should show connect button again
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();

    // Verify the integration was soft-deleted in the database
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.companyId, company.id),
        eq(integrations.type, "github"),
        isNull(integrations.deletedAt),
      ),
    });

    expect(integration).toBeUndefined();
  });

  test("redirects non-admin users", async ({ page }) => {
    const user = (await usersFactory.create()).user;
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    await login(page, user);
    await page.getByRole("link", { name: "Settings" }).click();

    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Integrations" })).not.toBeVisible();

    await page.goto("/settings/administrator/integrations");

    await expect(page.getByText("Access denied", { exact: true })).toBeVisible();
  });
});
