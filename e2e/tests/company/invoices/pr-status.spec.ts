import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyGithubConnectionsFactory } from "@test/factories/companyGithubConnections";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Invoice GitHub PR Enrichment", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let adminUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  let contractor: Awaited<ReturnType<typeof companyContractorsFactory.create>>["companyContractor"];
  let githubUsername: string;

  test.beforeEach(async () => {
    // Initial data setup
    company = await companiesFactory.createCompletedOnboarding();

    // Create admin user and role
    const adminResult = await usersFactory.create();
    adminUser = adminResult.user;
    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });

    // Create contractor user and profile with UNIQUE GitHub username to avoid constraint violations
    githubUsername = `gh-user-${Math.random().toString(36).substring(2, 11)}`;
    const contractorResult = await usersFactory.create({
      githubUsername,
      githubUid: String(Math.floor(Math.random() * 10000000)),
    });
    contractorUser = contractorResult.user;
    const contractorRecord = await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });
    contractor = contractorRecord.companyContractor;

    // Ensure company has a GitHub organization connection (needed for API fetching simulation)
    await companyGithubConnectionsFactory.create({
      companyId: company.company.id,
      connectedById: adminUser.id,
    });
  });

  test("renders PR card and verified author badge for contractor", async ({ page }) => {
    const verifiedUsername = `verified-${githubUsername}`;
    await db.update(users).set({ githubUsername: verifiedUsername }).where(eq(users.id, contractorUser.id));

    const invoiceLink = "https://github.com/mock-org/mock-repo/pull/1";
    const invoiceData = await invoicesFactory.create(
      {
        companyId: company.company.id,
        companyContractorId: contractor.id,
      },
      {
        lineItems: [
          {
            description: `Bounty for ${invoiceLink}`,
            quantity: "1",
            payRateInSubunits: 100000,
          },
        ],
      },
    );

    await login(page, contractorUser);
    await page.goto(`/invoices/${invoiceData.invoice.externalId}`);

    const prCard = page.getByText("mock-org/mock-repo").first();
    await expect(prCard).toBeVisible();

    await prCard.hover();

    await expect(page.getByRole("link", { name: "Initial PR #1" })).toBeVisible();

    await expect(page.locator("text=Verified author")).toBeVisible();
  });

  test("shows 'Unverified author' when GitHub usernames don't match", async ({ page }) => {
    const invoiceLink = "https://github.com/mock-org/mock-repo/pull/1";
    const invoiceData = await invoicesFactory.create(
      {
        companyId: company.company.id,
        companyContractorId: contractor.id,
      },
      {
        lineItems: [{ description: invoiceLink }],
      },
    );

    await login(page, contractorUser);
    await page.goto(`/invoices/${invoiceData.invoice.externalId}`);

    const prCard = page.getByText("mock-org/mock-repo").first();
    await prCard.hover();

    await expect(page.locator("text=Unverified author")).toBeVisible();
  });

  test("displays PR status with correct capitalization and color", async ({ page }) => {
    // PR #1 in mock is "Merged" (Purple)
    const invoiceData = await invoicesFactory.create(
      { companyContractorId: contractor.id },
      { lineItems: [{ description: "https://github.com/mock-org/mock-repo/pull/1" }] },
    );

    await login(page, contractorUser);
    await page.goto(`/invoices/${invoiceData.invoice.externalId}`);

    const prCard = page.getByText("mock-org/mock-repo").first();
    await prCard.hover();

    // Badge should say "Merged" (not MERGED) and have purple background
    const badge = page.locator('span:has-text("Merged")');
    await expect(badge).toBeVisible();
  });

  test("admin sees 'Paid on invoice' section for previously paid PRs", async ({ page }) => {
    const prUrl = "https://github.com/mock-org/mock-repo/pull/1";

    const paidInvoice = await invoicesFactory.create(
      {
        companyId: company.company.id,
        companyContractorId: contractor.id,
        status: "paid",
      },
      {
        lineItems: [{ description: prUrl }],
      },
    );

    const newInvoice = await invoicesFactory.create(
      {
        companyId: company.company.id,
        companyContractorId: contractor.id,
      },
      {
        lineItems: [{ description: prUrl }],
      },
    );

    await login(page, adminUser);
    await page.goto(`/invoices/${newInvoice.invoice.externalId}`);

    const prCard = page.getByText("mock-org/mock-repo").first();
    await prCard.hover();

    await expect(page.locator("text=Paid on invoice")).toBeVisible();
    await expect(page.locator(`text=#${paidInvoice.invoice.invoiceNumber}`)).toBeVisible();

    await login(page, contractorUser);
    await page.goto(`/invoices/${newInvoice.invoice.externalId}`);
    await page.getByText("mock-org/mock-repo").first().hover();
    await expect(page.locator("text=Paid on invoice")).not.toBeVisible();
  });

  test("displays orange dot indicator for paid PRs with bounties", async ({ page }) => {
    const bountyPr = "https://github.com/mock-org/mock-repo/pull/1";
    // First invoice is paid
    await invoicesFactory.create(
      {
        companyId: company.company.id,
        companyContractorId: contractor.id,
        status: "paid",
      },
      {
        lineItems: [{ description: bountyPr }],
      },
    );

    // Second invoice (currently viewing) also contains the PR
    const currentInvoice = await invoicesFactory.create(
      {
        companyId: company.company.id,
        companyContractorId: contractor.id,
        status: "received",
      },
      {
        lineItems: [{ description: bountyPr }],
      },
    );

    await login(page, adminUser);
    await page.goto(`/invoices/${currentInvoice.invoice.externalId}`);

    const orangeDot = page.locator("div.bg-\\[\\#D97706\\]");
    await expect(orangeDot).toBeVisible();
  });
});
