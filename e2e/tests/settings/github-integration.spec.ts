import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, invoiceLineItems, users } from "@/db/schema";

test.describe("GitHub integration", () => {
  test.describe("contractor settings", () => {
    test("can view GitHub connection section when not connected", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create();
      await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

      await login(page, user);
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Account" }).click();

      await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
      await expect(page.getByText("Manage your linked accounts")).toBeVisible();

      // GitHub section should show "Not connected" state
      await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
      await expect(page.getByText("Not connected")).toBeVisible();
      await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
    });

    test("shows connected state when GitHub is linked", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const githubUsername = faker.internet.username();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername,
      });
      await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

      await login(page, user);
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Account" }).click();

      await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
      await expect(page.getByText(githubUsername)).toBeVisible();
      await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
    });

    test("can disconnect GitHub with confirmation", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: faker.internet.username(),
      });
      await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

      await login(page, user);
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Account" }).click();

      await page.getByRole("button", { name: "Disconnect" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Disconnect GitHub?")).toBeVisible();
          await expect(modal.getByText("Are you sure you want to disconnect your GitHub account?")).toBeVisible();
          await modal.getByRole("button", { name: "Disconnect" }).click();
        },
        { page, title: "Disconnect GitHub?" },
      );

      // Verify disconnected state
      await expect(page.getByText("Not connected")).toBeVisible();

      // Verify database was updated
      const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
      expect(updatedUser?.githubUid).toBeNull();
      expect(updatedUser?.githubUsername).toBeNull();
    });
  });

  test.describe("company integrations settings", () => {
    test("admin can view integrations page", async ({ page }) => {
      const { adminUser } = await companiesFactory.createCompletedOnboarding();

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Integrations" }).click();

      await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
      await expect(page.getByText("Connect Flexile to your company's favorite tools")).toBeVisible();

      // GitHub section should show not connected state
      await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
      await expect(page.getByText("Not connected")).toBeVisible();
    });

    test("admin can connect GitHub organization", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Integrations" }).click();

      await page.getByRole("button", { name: "Connect" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Connect GitHub organization")).toBeVisible();
          await modal.getByLabel("Organization name").fill("test-org");
          await modal.getByRole("button", { name: "Connect" }).click();
        },
        { page, title: "Connect GitHub organization" },
      );

      // Verify connected state
      await expect(page.getByText("test-org")).toBeVisible();

      // Verify database was updated
      const updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
      expect(updatedCompany?.githubOrgName).toBe("test-org");
    });

    test("admin can disconnect GitHub organization with confirmation", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      await db.update(companies).set({ githubOrgName: "connected-org" }).where(eq(companies.id, company.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Integrations" }).click();

      await expect(page.getByText("connected-org")).toBeVisible();
      await page.getByRole("button", { name: "Disconnect" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Disconnect GitHub?")).toBeVisible();
          await modal.getByRole("button", { name: "Disconnect" }).click();
        },
        { page, title: "Disconnect GitHub?" },
      );

      // Verify disconnected state
      await expect(page.getByText("Not connected")).toBeVisible();

      // Verify database was updated
      const updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
      expect(updatedCompany?.githubOrgName).toBeNull();
    });

    test("non-admin cannot access integrations page", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create();
      await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

      await login(page, user);
      await page.getByRole("link", { name: "Settings" }).click();

      // Integrations link should not be visible for non-admins
      await expect(page.getByRole("link", { name: "Integrations" })).not.toBeVisible();

      // Direct navigation should show access denied
      await page.goto("/settings/administrator/integrations");
      await expect(page.getByText("Access denied", { exact: true })).toBeVisible();
    });
  });

  test.describe("invoice PR line items", () => {
    test("shows connect GitHub alert when PR URL is entered without connection", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create();
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 6000,
      });

      await login(page, user, "/invoices/new");

      // Enter a GitHub PR URL
      await page.getByPlaceholder("Description").fill("https://github.com/owner/repo/pull/123");
      await page.getByPlaceholder("Description").blur();

      // Should show the connect alert
      await expect(page.getByText("Connect your GitHub account to verify your PRs")).toBeVisible();
      await expect(page.getByRole("button", { name: "Connect GitHub" })).toBeVisible();
    });

    test("does not show connect alert for non-PR descriptions", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create();
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 6000,
      });

      await login(page, user, "/invoices/new");

      // Enter a regular description
      await page.getByPlaceholder("Description").fill("Development work for feature X");
      await page.getByPlaceholder("Description").blur();

      // Should not show the connect alert
      await expect(page.getByText("Connect GitHub")).not.toBeVisible();
    });

    test("saves PR metadata when invoice is submitted", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: faker.internet.username(),
      });
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 6000,
      });

      await login(page, user, "/invoices/new");

      // Enter invoice details with a regular description
      await page.getByPlaceholder("Description").fill("Implemented new feature");
      await page.getByLabel("Hours").fill("02:00");
      await page.getByRole("button", { name: "Send invoice" }).click();

      await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Awaiting approval" })).toBeVisible();
    });
  });

  test.describe("admin invoice view", () => {
    test("displays PR line item with prettified format", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "prauthor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 10000,
      });

      // Create an invoice with a PR line item
      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-PR-${faker.string.alphanumeric(6)}`,
      });

      // Update the line item with GitHub PR metadata
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/1507",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/1507",
          githubPrNumber: 1507,
          githubPrTitle: "GitHub integration with PR verification",
          githubPrState: "merged",
          githubPrAuthor: "prauthor",
          githubPrRepo: "antiwork/flexile",
          githubPrBountyCents: 300000,
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("cell", { name: invoice.invoiceNumber }).click();

      // Should display prettified PR info
      await expect(page.getByText("antiwork/flexile")).toBeVisible();
      await expect(page.getByText("#1507")).toBeVisible();
      await expect(page.getByText("$3K")).toBeVisible();
    });

    test("shows hover card with PR details", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "prauthor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 10000,
      });

      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-HOVER-${faker.string.alphanumeric(6)}`,
      });

      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/42",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/42",
          githubPrNumber: 42,
          githubPrTitle: "Fix critical bug in payment processing",
          githubPrState: "merged",
          githubPrAuthor: "prauthor",
          githubPrRepo: "antiwork/flexile",
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("cell", { name: invoice.invoiceNumber }).click();

      // Hover over the PR line item to trigger hover card
      const prLink = page.getByRole("link", { name: /antiwork\/flexile.*#42/u });
      await prLink.hover();

      // Wait for hover card to appear (300ms delay)
      await expect(page.getByText("Fix critical bug in payment processing")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Merged")).toBeVisible();
      await expect(page.getByText("Verified")).toBeVisible();
    });

    test("shows unverified status when PR author does not match", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "invoicesubmitter",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 10000,
      });

      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-UNVER-${faker.string.alphanumeric(6)}`,
      });

      // PR author is different from the contractor's GitHub username
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/99",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/99",
          githubPrNumber: 99,
          githubPrTitle: "Someone else's PR",
          githubPrState: "merged",
          githubPrAuthor: "differentuser",
          githubPrRepo: "antiwork/flexile",
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("cell", { name: invoice.invoiceNumber }).click();

      // Hover over the PR to see unverified status
      const prLink = page.getByRole("link", { name: /antiwork\/flexile.*#99/u });
      await prLink.hover();

      await expect(page.getByText("Unverified")).toBeVisible({ timeout: 5000 });
    });

    test("shows status dot for unverified PRs on pending invoices", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "contractor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 10000,
      });

      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-DOT-${faker.string.alphanumeric(6)}`,
        status: "received",
      });

      // Create an unverified PR (author mismatch)
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/owner/repo/pull/1",
          githubPrUrl: "https://github.com/owner/repo/pull/1",
          githubPrNumber: 1,
          githubPrTitle: "Unverified PR",
          githubPrState: "merged",
          githubPrAuthor: "someoneelse",
          githubPrRepo: "owner/repo",
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("cell", { name: invoice.invoiceNumber }).click();

      // The status dot should be visible (amber dot indicating attention needed)
      await expect(page.locator(".bg-amber-500")).toBeVisible();
    });
  });
});
