import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
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

      // Page header per design
      await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
      await expect(page.getByText("Manage your linked accounts and workspace access.")).toBeVisible();

      // GitHub section per design - shows "Link your GitHub account to verify ownership of your work."
      await expect(page.getByText("GitHub", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Link your GitHub account to verify ownership of your work.")).toBeVisible();
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

      // Per design: connected state shows username with green dot in dropdown button
      await expect(page.getByText("GitHub", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Your account is linked for verifying pull requests and bounties.")).toBeVisible();
      // Username shown in dropdown trigger button with green dot
      await expect(page.getByRole("button", { name: githubUsername })).toBeVisible();
    });

    test("can disconnect GitHub with confirmation", async ({ page }) => {
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

      // Click dropdown to reveal disconnect option
      await page.getByRole("button", { name: githubUsername }).click();
      await page.getByRole("menuitem", { name: "Disconnect" }).click();

      // Per design: modal title "Disconnect GitHub account?" and description (AlertDialog)
      const modal = page.getByRole("alertdialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByText("Disconnect GitHub account?")).toBeVisible();
      await expect(modal.getByText("Disconnecting stops us from verifying your GitHub work.")).toBeVisible();
      await modal.getByRole("button", { name: "Disconnect" }).click();

      // Verify disconnected state - back to "Link your GitHub account..." text
      await expect(page.getByText("Link your GitHub account to verify ownership of your work.")).toBeVisible();

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

      // Per design: page header
      await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
      await expect(page.getByText("Connect Flexile to your company's favorite tools.")).toBeVisible();

      // Per design: GitHub card with description
      await expect(page.getByText("GitHub", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Automatically verify contractor pull requests and bounty claims.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Connect" }).first()).toBeVisible();
    });

    test("admin can connect GitHub organization", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user: adminUser } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "admin-user",
      });
      await companyAdministratorsFactory.create({
        companyId: company.id,
        userId: adminUser.id,
      });

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Integrations" }).click();

      let installationUrlCalled = false;
      await page.route("**/internal/github/app_installation_url", async (route) => {
        installationUrlCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            url: "/github/installation?installation_id=12345678&setup_action=install&state=test-state&code=test-code",
          }),
        });
      });

      await page.route("**/internal/github/installation_callback", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            installation_id: "12345678",
            company_id: company.externalId,
            auto_connected: true,
            org_name: "test-org",
          }),
        });

        await db
          .update(companies)
          .set({ githubOrgName: "test-org", githubOrgId: BigInt(12345) })
          .where(eq(companies.id, company.id));
      });

      const connectButton = page.getByRole("button", { name: "Connect" }).first();
      await expect(connectButton).toBeVisible();
      await connectButton.click();

      await page.waitForTimeout(500);
      expect(installationUrlCalled).toBe(true);

      await expect(page.getByText("GitHub App Installed!")).toBeVisible({ timeout: 10000 });
      await page.waitForURL("**/settings/administrator/integrations", { timeout: 10000 });

      await expect(page.getByRole("button", { name: "test-org" })).toBeVisible({ timeout: 5000 });

      const updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
      expect(updatedCompany?.githubOrgName).toBe("test-org");
      expect(updatedCompany?.githubOrgId).toBe(BigInt(12345));
    });

    test("admin can disconnect GitHub organization with confirmation", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      await db.update(companies).set({ githubOrgName: "connected-org" }).where(eq(companies.id, company.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Integrations" }).click();

      // Click dropdown to reveal disconnect option
      await page.getByRole("button", { name: "connected-org" }).click();
      await page.getByRole("menuitem", { name: "Disconnect" }).click();

      // Per design: "Disconnect GitHub organization?" with specific description (AlertDialog)
      const modal = page.getByRole("alertdialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByText("Disconnect GitHub organization?")).toBeVisible();
      await expect(
        modal.getByText(
          "This will prevent contractors from verifying Pull Request ownership and disable automatic bounty checks.",
        ),
      ).toBeVisible();
      await modal.getByRole("button", { name: "Disconnect" }).click();

      // Wait for modal to close and Connect button to appear
      await expect(modal).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("button", { name: "Connect" }).first()).toBeVisible({ timeout: 10000 });

      // Verify database was updated
      const updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
      expect(updatedCompany?.githubOrgName).toBeNull();
    });

    test("non-admin cannot see integrations link in settings", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create();
      await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

      await login(page, user);
      await page.getByRole("link", { name: "Settings" }).click();

      // Integrations link should not be visible for non-admins (only shown under Company section for admins)
      await expect(page.getByRole("link", { name: "Integrations" })).not.toBeVisible();
    });
  });

  test.describe("invoice PR line items", () => {
    test("shows connect GitHub alert when PR URL is entered without connection", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      // Set up GitHub org so the alert triggers for PRs from this org
      await db.update(companies).set({ githubOrgName: "antiwork" }).where(eq(companies.id, company.id));
      const { user } = await usersFactory.create();
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 100000, // $1000/hr
      });

      await login(page, user, "/invoices/new");

      // Enter a GitHub PR URL from the company's org
      await page.getByPlaceholder("Description").first().fill("https://github.com/antiwork/flexile/pull/1503");
      await page.getByPlaceholder("Description").first().blur();

      // Alert message and Connect GitHub button when user has no GitHub connected
      await expect(
        page.getByText("You linked a Pull Request from antiwork. Connect GitHub to verify your ownership."),
      ).toBeVisible();
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

    test("can submit invoice with regular line item", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create();
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

    test("re-fetches PR details when PR URL is changed on invoice edit", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      await db.update(companies).set({ githubOrgName: "antiwork" }).where(eq(companies.id, company.id));
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "testcontractor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000,
      });

      // Create an invoice with an existing PR line item
      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: "INV-PR-EDIT-TEST",
      });
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/100",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/100",
          githubPrNumber: 100,
          githubPrTitle: "Original PR title",
          githubPrState: "merged",
          githubPrAuthor: "testcontractor",
          githubPrRepo: "antiwork/flexile",
          githubPrBountyCents: 10000,
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, user);
      await page.goto("/invoices");
      await page.getByRole("cell", { name: "INV-PR-EDIT-TEST" }).click();
      await page.getByRole("link", { name: "Edit invoice" }).click();
      await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

      // Verify the stored PR data renders as a prettified PR line item (not raw URL)
      await expect(page.getByText("antiwork/flexile")).toBeVisible();
      await expect(page.getByText("#100")).toBeVisible();
      await expect(page.getByText("Original PR title")).toBeVisible();

      // Intercept the PR details API to return data for the new PR URL
      let prFetchUrl = "";
      await page.route("**/internal/github/pr**", async (route) => {
        prFetchUrl = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            pr: {
              url: "https://github.com/antiwork/flexile/pull/200",
              number: 200,
              title: "Updated PR title",
              state: "open",
              author: "testcontractor",
              repo: "antiwork/flexile",
              bounty_cents: 20000,
            },
          }),
        });
      });

      // Click on the PR line item to enter edit mode, then change the URL
      await page.getByText("Original PR title").click();
      const descriptionInput = page.getByPlaceholder("Description or GitHub PR link...");
      await expect(descriptionInput).toBeVisible();
      await descriptionInput.fill("https://github.com/antiwork/flexile/pull/200");
      await descriptionInput.blur();

      // Verify the new PR details are fetched and displayed
      await expect(page.getByText("#200")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Updated PR title")).toBeVisible();
      expect(prFetchUrl).toContain("pull%2F200");
    });

    test("uses stored PR data without re-fetching when URL has not changed on edit", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      await db.update(companies).set({ githubOrgName: "antiwork" }).where(eq(companies.id, company.id));
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "testcontractor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000,
      });

      // Create an invoice with an existing PR line item
      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: "INV-PR-NO-REFETCH",
      });
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/300",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/300",
          githubPrNumber: 300,
          githubPrTitle: "Stored PR title",
          githubPrState: "merged",
          githubPrAuthor: "testcontractor",
          githubPrRepo: "antiwork/flexile",
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      // Track whether the PR API is called
      let prApiFetched = false;
      await page.route("**/internal/github/pr**", async (route) => {
        prApiFetched = true;
        await route.abort();
      });

      await login(page, user);
      await page.goto("/invoices");
      await page.getByRole("cell", { name: "INV-PR-NO-REFETCH" }).click();
      await page.getByRole("link", { name: "Edit invoice" }).click();
      await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

      // Stored PR data should display without any API fetch
      await expect(page.getByText("antiwork/flexile")).toBeVisible();
      await expect(page.getByText("#300")).toBeVisible();
      await expect(page.getByText("Stored PR title")).toBeVisible();

      // Wait a moment to confirm no API call was made
      await page.waitForTimeout(500);
      expect(prApiFetched).toBe(false);
    });
  });

  test.describe("admin invoice view", () => {
    test("displays PR line item with prettified format including bounty badge", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "prauthor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000, // $250/hr
      });

      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-PR-${faker.string.alphanumeric(6)}`,
      });

      // Per design: PR shows as "[icon] antiwork/flexile  Title...#242  $250"
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/242",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/242",
          githubPrNumber: 242,
          githubPrTitle: "Migrate to accessible date picker",
          githubPrState: "merged",
          githubPrAuthor: "prauthor",
          githubPrRepo: "antiwork/flexile",
          githubPrBountyCents: 25000, // $250 bounty
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("row", { name: new RegExp(user.legalName ?? "", "u") }).click();

      // Should display prettified PR info per design
      await expect(page.getByText("antiwork/flexile")).toBeVisible();
      await expect(page.getByText("#242")).toBeVisible();
      // Bounty badge - use more specific selector to avoid matching the rate warning alert
      await expect(page.locator("[data-slot='badge']").getByText("$250")).toBeVisible();
    });

    test("shows hover card with PR details and verified status", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "laugardie",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000,
      });

      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-HOVER-${faker.string.alphanumeric(6)}`,
      });

      // Per design hover card: shows repo · author, title #number, Merged badge, Verified status
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/242",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/242",
          githubPrNumber: 242,
          githubPrTitle: "Migrate to accessible date picker",
          githubPrState: "merged",
          githubPrAuthor: "laugardie", // Matches user's githubUsername
          githubPrRepo: "antiwork/flexile",
          githubPrBountyCents: 25000,
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("row", { name: new RegExp(user.legalName ?? "", "u") }).click();

      // Hover over the PR line item to trigger hover card (300ms delay per design)
      const prLink = page.getByRole("link", { name: /antiwork\/flexile.*#242/u });
      await prLink.hover();

      // Per design: hover card shows repo · author
      await expect(page.getByText("antiwork/flexile · laugardie")).toBeVisible({ timeout: 5000 });
      // PR title in hover card (use the hover card content which has the full title without truncation)
      const hoverCardContent = page.locator("[data-radix-popper-content-wrapper]");
      await expect(hoverCardContent.getByText("Migrate to accessible date picker")).toBeVisible();
      // Status badge
      await expect(hoverCardContent.getByText("Merged")).toBeVisible();
      // Verified status per design
      await expect(page.getByText("Verified author of this pull request.")).toBeVisible();
    });

    test("shows unverified status in hover card when PR author does not match", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "invoicesubmitter",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 100000,
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
          githubPrAuthor: "differentuser", // Does NOT match invoicesubmitter
          githubPrRepo: "antiwork/flexile",
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("row", { name: new RegExp(user.legalName ?? "", "u") }).click();

      // Hover to see unverified status
      const prLink = page.getByRole("link", { name: /antiwork\/flexile.*#99/u });
      await prLink.hover();

      // Per design: "Unverified author of this pull request."
      await expect(page.getByText("Unverified author of this pull request.")).toBeVisible({ timeout: 5000 });
    });

    test("shows amber status dot for unverified PRs on pending invoices", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "contractor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000,
      });

      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-DOT-${faker.string.alphanumeric(6)}`,
        status: "received", // Pending invoice
      });

      // Create an unverified PR (author mismatch)
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/gumroad/pull/333",
          githubPrUrl: "https://github.com/antiwork/gumroad/pull/333",
          githubPrNumber: 333,
          githubPrTitle: "Migrate Dropdown to Tailwind",
          githubPrState: "merged",
          githubPrAuthor: "someoneelse", // Does NOT match contractor
          githubPrRepo: "antiwork/gumroad",
          githubPrBountyCents: 50000, // $500
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      await page.getByRole("row", { name: new RegExp(user.legalName ?? "", "u") }).click();

      // Per design: amber/orange status dot indicates attention needed
      await expect(page.locator(".bg-amber-500")).toBeVisible();
    });

    test("shows paid status in hover card when PR was previously paid", async ({ page }) => {
      const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "laugardie",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000,
      });

      // Create an older paid invoice with this PR
      const { invoice: paidInvoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: "2025-21",
        status: "paid",
      });
      await db
        .update(invoiceLineItems)
        .set({
          githubPrUrl: "https://github.com/antiwork/flexile/pull/242",
          githubPrNumber: 242,
          githubPrRepo: "antiwork/flexile",
        })
        .where(eq(invoiceLineItems.invoiceId, paidInvoice.id));

      // Create new invoice with the same PR (pending status shows in default filter)
      const { invoice: newInvoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-PAID-${faker.string.alphanumeric(6)}`,
        status: "received",
      });
      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/flexile/pull/242",
          githubPrUrl: "https://github.com/antiwork/flexile/pull/242",
          githubPrNumber: 242,
          githubPrTitle: "Migrate to accessible date picker",
          githubPrState: "merged",
          githubPrAuthor: "laugardie",
          githubPrRepo: "antiwork/flexile",
          githubPrBountyCents: 25000,
        })
        .where(eq(invoiceLineItems.invoiceId, newInvoice.id));

      await login(page, adminUser, "/people");
      await page.getByRole("link", { name: "Invoices" }).click();
      // Click on the contractor row (admin view shows contractor name, not invoice number)
      await page.getByRole("row", { name: new RegExp(user.legalName ?? "", "u") }).click();

      // Hover to see paid status
      const prLink = page.getByRole("link", { name: /antiwork\/flexile.*#242/u });
      await prLink.hover();

      // Per design: "Paid on invoice #2025-21" with clickable invoice link
      await expect(page.getByText(/Paid on invoice/u)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("#2025-21")).toBeVisible();
    });

    test("does not show status dot on paid invoices", async ({ page }) => {
      const { company } = await companiesFactory.createCompletedOnboarding();
      const { user } = await usersFactory.create({
        githubUid: faker.string.numeric(10),
        githubUsername: "contractor",
      });
      const { companyContractor } = await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        payRateInSubunits: 25000,
      });

      // Create a PAID invoice with an unverified PR
      const { invoice } = await invoicesFactory.create({
        companyContractorId: companyContractor.id,
        invoiceNumber: `INV-PAID-${faker.string.alphanumeric(6)}`,
        status: "paid", // Already paid
      });

      await db
        .update(invoiceLineItems)
        .set({
          description: "https://github.com/antiwork/gumroad/pull/333",
          githubPrUrl: "https://github.com/antiwork/gumroad/pull/333",
          githubPrNumber: 333,
          githubPrTitle: "Migrate Dropdown to Tailwind",
          githubPrState: "merged",
          githubPrAuthor: "someoneelse", // Unverified - but shouldn't show dot since invoice is paid
          githubPrRepo: "antiwork/gumroad",
          githubPrBountyCents: 50000,
        })
        .where(eq(invoiceLineItems.invoiceId, invoice.id));

      // Login as contractor and view their own invoice
      await login(page, user);
      await page.getByRole("link", { name: "Invoices" }).click();

      // Click on the paid invoice (contractor sees their own invoices without status filter)
      await page.getByRole("row", { name: new RegExp(invoice.invoiceNumber, "u") }).click();

      // Verify the PR line item is displayed
      await expect(page.getByText("antiwork/gumroad")).toBeVisible();
      await expect(page.getByText("#333")).toBeVisible();

      // Per design: status dot is NOT shown on paid invoices (only visible to admins anyway,
      // and even for admins it's not shown on paid invoices)
      await expect(page.locator(".bg-amber-500")).not.toBeVisible();
    });
  });
});
