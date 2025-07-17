import { faker } from "@faker-js/faker";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { companies, users } from "@/db/schema";

test.describe.serial("Onboarding checklist", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let contractWorkerUser: typeof users.$inferSelect;

  test.beforeAll(async () => {
    company = (await companiesFactory.createPreOnboarding({ requiredInvoiceApprovalCount: 1 })).company;

    adminUser = (await usersFactory.create()).user;
    contractWorkerUser = (await usersFactory.create(undefined, { withoutComplianceInfo: true })).user;
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });
  });

  test("completes admin onboarding checklist by adding company details, bank account, and inviting contractor", async ({
    page,
  }) => {
    await login(page, adminUser);

    await expect(page.getByRole("button", { name: "Getting started" })).toBeVisible();

    await expect(page.getByText("Add company details")).toBeVisible();
    await expect(page.getByText("Add bank account")).toBeVisible();
    await expect(page.getByText("Invite a contractor")).toBeVisible();
    await expect(page.getByText("Send your first payment")).toBeVisible();

    await page.getByText("Add company details").click();
    await page.getByLabel("Company's legal name").fill(faker.company.name());
    await page.getByLabel("EIN").fill(faker.string.numeric(9));
    await page.getByLabel("Phone number").fill(faker.phone.number());
    await page.getByLabel("Residential address").fill(faker.location.streetAddress());
    await page.getByLabel("City or town").fill(faker.location.city());
    await page.getByLabel("State").click();
    await page.getByRole("option", { name: faker.location.state(), exact: true }).click();
    await page.getByLabel("ZIP code").fill(faker.location.zipCode());
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();
    await page.getByRole("link", { name: "Back to app" }).click();
    await expect(page.getByText("25%")).toBeVisible();

    await page.getByText("Add bank account").click();
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
    await companyStripeAccountsFactory.create({
      companyId: company.id,
    });
    await page.reload();
    await page.getByRole("link", { name: "Back to app" }).click();
    await expect(page.getByText("50%")).toBeVisible();

    await page.getByText("Invite a contractor").click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await page.getByRole("button", { name: "Add contractor" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByText("Who's joining?")).toBeVisible();
        await modal.getByLabel("Email").fill(contractWorkerUser.email);
        await modal.getByLabel("Role").fill("Software Engineer");
        await modal.getByLabel("Hourly").check();
        await modal.getByLabel("Rate").fill("100");
        await modal.getByLabel("Already signed contract elsewhere.").check({ force: true });
        await modal.getByRole("button", { name: "Send invite" }).click();
        await modal.waitFor({ state: "detached" });
      },
      { page },
    );

    await expect(page.getByText("75%")).toBeVisible();

    const checklistItems = page.locator('[class*="space-y-1"] > button');
    await expect(checklistItems.nth(0).getByText("Add company details")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(1).getByText("Add bank account")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(2).getByText("Invite a contractor")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(3).getByText("Send your first payment")).not.toHaveClass(/line-through/u);
  });

  test("persists admin onboarding checklist progress across sessions", async ({ page }) => {
    await login(page, adminUser);

    await expect(page.getByText("75%")).toBeVisible();

    const checklistItems = page.locator('[class*="space-y-1"] > button');
    await expect(checklistItems.nth(0).getByText("Add company details")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(1).getByText("Add bank account")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(2).getByText("Invite a contractor")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(3).getByText("Send your first payment")).not.toHaveClass(/line-through/u);
  });

  test("completes worker onboarding checklist by external signed contract, filling tax information and adding payout details", async ({
    page,
  }) => {
    await login(page, contractWorkerUser);

    await expect(page.getByText("Fill tax information")).toBeVisible();
    await expect(page.getByText("Add payout information")).toBeVisible();
    await expect(page.getByText("Sign contract")).toBeVisible();

    await page.getByText("Fill tax information").click();
    await expect(page).toHaveURL(/\/settings\/tax/u);
    await page.getByLabel("Tax ID").fill(faker.string.numeric(9));
    await page.getByRole("button", { name: "Save changes" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Save", exact: true }).click();
      },
      { page },
    );
    await page.getByRole("link", { name: "Back to app" }).click();

    await expect(page.getByText("67%")).toBeVisible();

    const checklistItems = page.locator('[class*="space-y-1"] > button');
    await expect(checklistItems.nth(0).getByText("Fill tax information")).toHaveClass(/line-through/u);
    await expect(checklistItems.nth(1).getByText("Add payout information")).not.toHaveClass(/line-through/u);
    await expect(checklistItems.nth(2).getByText("Sign contract")).toHaveClass(/line-through/u);

    await page.getByText("Add payout information").click();
    await expect(page).toHaveURL(/\/settings\/payouts/u);
    await page.getByText("Add bank account").click();
    await withinModal(
      async (modal) => {
        await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
        await modal.getByLabel("Full name of the account holder").fill(faker.person.fullName());
        await modal.getByLabel("Routing number").fill("071004200");
        await modal.getByLabel("Account number").fill("12345678");
        await modal.getByRole("button", { name: "Continue" }).click();
        await modal.getByLabel("Country").click();
        await modal.getByRole("option", { name: "United States", exact: true }).click();
        await modal.getByLabel("City").fill(faker.location.city());
        await modal.getByLabel("Street address, apt number").fill(faker.location.streetAddress());
        await modal.getByLabel("State").click();
        await modal.getByRole("option", { name: faker.location.state(), exact: true }).click();
        await modal.getByLabel("ZIP code").fill(faker.location.zipCode());
        await modal.getByRole("button", { name: "Save bank account" }).click();
      },
      { page },
    );
    await expect(page.getByText("Ending in 5678")).toBeVisible();
    await page.getByRole("link", { name: "Back to app" }).click();

    await expect(page.getByText("You are all set!")).toBeVisible();
    await expect(page.getByText("You are ready to send your first invoice.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("hides onboarding checklist after completion and allows worker to send first invoice", async ({ page }) => {
    await login(page, contractWorkerUser);

    await page.goto("/invoices");

    await expect(page.getByRole("button", { name: "Getting started" })).not.toBeVisible();

    await page.getByLabel("Hours / Qty").fill("10:30");
    await page.getByLabel("Rate").fill("50");
    await expect(page.getByText("Total amount$525")).toBeVisible();
    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByRole("row").getByText("$525")).toBeVisible();
  });

  test("completes admin onboarding checklist by paying first invoice and showing completion message", async ({
    page,
  }) => {
    await login(page, adminUser);

    await page.goto("/invoices");

    await page.getByRole("row").getByText("Pay now").click();

    await expect(page.getByText("You are all set!")).toBeVisible();
    await expect(page.getByText("Everything is in place. Time to flex.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  });
});
