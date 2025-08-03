import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { integrationsFactory } from "@test/factories/integrations";
import { login } from "@test/helpers/auth";
import { mockQuickbooks } from "@test/helpers/quickbooks";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { integrations, users } from "@/db/schema";

test.describe("QuickBooks integration", () => {
  test("allows connecting QuickBooks integration", async ({ page, next }) => {
    const { company } = await companiesFactory.create({ jsonData: { flags: ["quickbooks"] } });
    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    const { mockOAuthFlow } = mockQuickbooks(next);
    await mockOAuthFlow(page);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Workspace settings" }).click();

    await expect(page.getByText("QuickBooks")).toBeVisible();
    await expect(page.getByText("Sync invoices, payments, and expenses")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();

    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Set up QuickBooks integration")).toBeVisible();

    await expect(page.getByText("Expense account for consulting services")).toBeVisible();
    await expect(page.getByText("Expense account for Flexile fees")).toBeVisible();
    await expect(page.getByText("Bank account")).toBeVisible();
  });

  test("shows reconnect option for out_of_sync integration", async ({ page, next }) => {
    const { company } = await companiesFactory.create({ jsonData: { flags: ["quickbooks"] } });
    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    await integrationsFactory.createQuickbooks(company.id, {
      status: "out_of_sync",
    });

    const { mockOAuthFlow } = mockQuickbooks(next);
    await mockOAuthFlow(page);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Workspace settings" }).click();

    await expect(page.getByText("Needs reconnecting")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();

    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("shows setup required for incomplete integration", async ({ page }) => {
    const { company } = await companiesFactory.create({ jsonData: { flags: ["quickbooks"] } });
    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    await integrationsFactory.createQuickbooks(company.id, {
      status: "active",
      configuration: {
        consulting_services_expense_account_id: null,
        flexile_fees_expense_account_id: null,
        default_bank_account_id: null,
      },
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Workspace settings" }).click();

    await expect(page.getByText("Setup required")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish setup" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  });

  test("allows completing integration setup", async ({ page, next }) => {
    const { company } = await companiesFactory.create({ jsonData: { flags: ["quickbooks"] } });
    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    const { integration } = await integrationsFactory.createQuickbooks(company.id, {
      status: "active",
      configuration: {
        consulting_services_expense_account_id: null,
        flexile_fees_expense_account_id: null,
        default_bank_account_id: null,
      },
    });

    mockQuickbooks(next);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Workspace settings" }).click();

    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Professional Services" }).click();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Software Subscriptions" }).click();

    await page.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Business Checking" }).click();

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();

    if (integration) {
      const updatedIntegration = await db.query.integrations
        .findFirst({ where: eq(integrations.id, integration.id) })
        .then(takeOrThrow);
      expect(updatedIntegration.configuration?.consulting_services_expense_account_id).toBe("789");
    }
  });

  test("allows disconnecting QuickBooks integration", async ({ page, next }) => {
    const { company } = await companiesFactory.create({ jsonData: { flags: ["quickbooks"] } });
    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    const { integration } = await integrationsFactory.createQuickbooks(company.id, {
      status: "active",
    });

    mockQuickbooks(next);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Workspace settings" }).click();

    await expect(page.getByText("Connected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("Disconnected!")).toBeVisible();

    if (integration) {
      const updatedIntegration = await db.query.integrations
        .findFirst({ where: eq(integrations.id, integration.id) })
        .then(takeOrThrow);
      expect(updatedIntegration.status).toBe("deleted");
      expect(updatedIntegration.deletedAt).toBeTruthy();
    }
  });
});
