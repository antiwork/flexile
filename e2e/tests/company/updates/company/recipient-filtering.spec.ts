import { expect, test } from "@playwright/test";
import {
  seedCompany,
  seedCompanyAdministrator,
  seedCompanyContractor,
  seedCompanyInvestor,
  seedCompanyUpdate,
  seedInvoice,
  seedUser,
} from "@/e2e/factories";
import { login } from "@/e2e/helpers";

test.describe("Company Update Recipient Filtering", () => {
  test("should allow selecting contractors and investors as recipients", async ({ page }) => {
    // Seed test data
    const admin = await seedUser();
    const company = await seedCompany();
    await seedCompanyAdministrator({ companyId: company.id, userId: admin.id });

    // Create contractors
    const activeContractor = await seedUser();
    await seedCompanyContractor({
      companyId: company.id,
      userId: activeContractor.id,
      endedAt: null,
    });

    const alumniContractor = await seedUser();
    await seedCompanyContractor({
      companyId: company.id,
      userId: alumniContractor.id,
      endedAt: new Date(),
    });

    // Create investors
    const investor1 = await seedUser();
    await seedCompanyInvestor({
      companyId: company.id,
      userId: investor1.id,
      investorType: "angel",
    });

    const investor2 = await seedUser();
    await seedCompanyInvestor({
      companyId: company.id,
      userId: investor2.id,
      investorType: "vc",
    });

    await login(page, admin);
    await page.goto(`/updates/company/new`);

    // Fill in update details
    await page.fill('input[name="title"]', "Test Update");
    await page.locator(".ProseMirror").fill("This is a test company update.");

    // Check recipient selector is visible
    await expect(page.getByText("Recipients")).toBeVisible();
    await expect(page.getByText("Company administrators")).toBeVisible();

    // Test contractor selection
    const contractorCheckbox = page.locator("#includeContractors");
    await contractorCheckbox.check();
    await expect(page.getByText("Active contractors only (1)")).toBeVisible();
    await expect(page.getByText("All contractors including alumni")).toBeVisible();

    // Select all contractors
    await page.getByText("All contractors including alumni").click();

    // Test investor selection
    const investorCheckbox = page.locator("#includeInvestors");
    await expect(investorCheckbox).toBeChecked(); // Should be checked by default
    await expect(page.getByText("Include investors (2)")).toBeVisible();

    // Click preview button
    await page.getByRole("button", { name: "Preview" }).click();

    // Check preview modal
    await expect(page.getByText("Preview update")).toBeVisible();
    await expect(page.getByText("A preview email will be sent to your email address")).toBeVisible();
    await expect(page.getByText(/The actual update will be sent to \d+ recipients/)).toBeVisible();
  });

  test("should filter contractors by billing threshold", async ({ page }) => {
    // Seed test data
    const admin = await seedUser();
    const company = await seedCompany();
    await seedCompanyAdministrator({ companyId: company.id, userId: admin.id });

    // Create contractors with different billing amounts
    const highBillingContractor = await seedUser();
    const contractorRelation1 = await seedCompanyContractor({
      companyId: company.id,
      userId: highBillingContractor.id,
      endedAt: null,
    });

    // Create invoice with high amount
    await seedInvoice({
      companyId: company.id,
      companyContractorId: contractorRelation1.id,
      totalAmountInUsdCents: 200000, // $2000
    });

    const lowBillingContractor = await seedUser();
    const contractorRelation2 = await seedCompanyContractor({
      companyId: company.id,
      userId: lowBillingContractor.id,
      endedAt: null,
    });

    // Create invoice with low amount
    await seedInvoice({
      companyId: company.id,
      companyContractorId: contractorRelation2.id,
      totalAmountInUsdCents: 50000, // $500
    });

    await login(page, admin);
    await page.goto(`/updates/company/new`);

    // Fill in update details
    await page.fill('input[name="title"]', "Filtered Update");
    await page.locator(".ProseMirror").fill("This update is for high-billing contractors.");

    // Enable contractors and set billing threshold
    await page.locator("#includeContractors").check();
    await page.fill('input[type="number"][placeholder="e.g. 1000"]', "1000");

    // The recipient count should reflect the filtering
    await expect(page.getByText("Only include contractors who have billed ≥ this amount")).toBeVisible();
  });

  test("should handle de-duplication of users who are both contractors and investors", async ({ page }) => {
    // Seed test data
    const admin = await seedUser();
    const company = await seedCompany();
    await seedCompanyAdministrator({ companyId: company.id, userId: admin.id });

    // Create a user who is both contractor and investor
    const dualRoleUser = await seedUser();
    await seedCompanyContractor({
      companyId: company.id,
      userId: dualRoleUser.id,
      endedAt: null,
    });
    await seedCompanyInvestor({
      companyId: company.id,
      userId: dualRoleUser.id,
    });

    // Create a regular investor
    const investorOnly = await seedUser();
    await seedCompanyInvestor({
      companyId: company.id,
      userId: investorOnly.id,
    });

    await login(page, admin);
    await page.goto(`/updates/company/new`);

    // Fill in update details
    await page.fill('input[name="title"]', "De-duplication Test");
    await page.locator(".ProseMirror").fill("Testing de-duplication of recipients.");

    // Enable both contractors and investors
    await page.locator("#includeContractors").check();
    const investorCheckbox = page.locator("#includeInvestors");
    await expect(investorCheckbox).toBeChecked();

    // The recipient count should not double-count the dual-role user
    // Expected: 1 admin + 1 contractor/investor + 1 investor = 3 total
    await expect(page.getByText("Recipients (3)")).toBeVisible();
  });

  test("should publish update with selected recipients", async ({ page }) => {
    // Seed test data
    const admin = await seedUser();
    const company = await seedCompany();
    await seedCompanyAdministrator({ companyId: company.id, userId: admin.id });

    const contractor = await seedUser();
    await seedCompanyContractor({
      companyId: company.id,
      userId: contractor.id,
      endedAt: null,
    });

    const investor = await seedUser();
    await seedCompanyInvestor({
      companyId: company.id,
      userId: investor.id,
    });

    await login(page, admin);
    await page.goto(`/updates/company/new`);

    // Fill in update
    await page.fill('input[name="title"]', "Publishing Test");
    await page.locator(".ProseMirror").fill("This is a test of the publishing flow.");

    // Select only contractors
    await page.locator("#includeContractors").check();
    await page.locator("#includeInvestors").uncheck();

    // Publish
    await page.getByRole("button", { name: "Publish" }).click();

    // Confirm in modal
    await expect(page.getByText("Publish update?")).toBeVisible();
    await page.getByRole("button", { name: "Yes, publish" }).click();

    // Should redirect to updates list
    await expect(page).toHaveURL("/updates/company");
    await expect(page.getByText("Publishing Test")).toBeVisible();
  });
});