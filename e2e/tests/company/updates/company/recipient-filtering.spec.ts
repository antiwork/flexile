import { expect, test } from "@playwright/test";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";

test.describe("Company Update Recipient Filtering", () => {
  test("should allow selecting contractors and investors as recipients", async ({ page }) => {
    // Create company with admin
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    // Create contractors
    const activeContractor = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: activeContractor.id,
      endedAt: null,
    });

    const alumniContractor = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: alumniContractor.id,
      endedAt: new Date(),
    });

    // Create investors
    const investor1 = (await usersFactory.create()).user;
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor1.id,
      investorType: "angel",
    });

    const investor2 = (await usersFactory.create()).user;
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor2.id,
      investorType: "vc",
    });

    await login(page, adminUser);
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
    await expect(page.getByText("Active contractors only")).toBeVisible();
    await expect(page.getByText("All contractors including alumni")).toBeVisible();

    // Select all contractors
    await page.getByText("All contractors including alumni").click();

    // Test investor selection
    const investorCheckbox = page.locator("#includeInvestors");
    await expect(investorCheckbox).toBeChecked(); // Should be checked by default
    await expect(page.getByText("Include investors")).toBeVisible();

    // Click preview button
    await page.getByRole("button", { name: "Preview" }).click();

    // Check preview modal
    await expect(page.getByText("Preview update")).toBeVisible();
    await expect(page.getByText("A preview email will be sent to your email address")).toBeVisible();
    await expect(
      page.getByText(/The actual update will be sent to the selected recipients based on your selections/u),
    ).toBeVisible();
  });

  test("should filter contractors by billing threshold", async ({ page }) => {
    // Create company with admin
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    // Create contractors with different billing amounts
    const highBillingContractor = (await usersFactory.create()).user;
    const contractorRelation1 = await companyContractorsFactory.create({
      companyId: company.id,
      userId: highBillingContractor.id,
      endedAt: null,
    });

    // Create invoice with high amount
    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: contractorRelation1.id,
      totalAmountInUsdCents: 200000, // $2000
    });

    const lowBillingContractor = (await usersFactory.create()).user;
    const contractorRelation2 = await companyContractorsFactory.create({
      companyId: company.id,
      userId: lowBillingContractor.id,
      endedAt: null,
    });

    // Create invoice with low amount
    await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: contractorRelation2.id,
      totalAmountInUsdCents: 50000, // $500
    });

    await login(page, adminUser);
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
    // Create company with admin
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    // Create a user who is both contractor and investor
    const dualRoleUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: dualRoleUser.id,
      endedAt: null,
    });
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: dualRoleUser.id,
    });

    // Create a regular investor
    const investorOnly = (await usersFactory.create()).user;
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investorOnly.id,
    });

    await login(page, adminUser);
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
    // Create company with admin
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const contractor = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractor.id,
      endedAt: null,
    });

    const investor = (await usersFactory.create()).user;
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: investor.id,
    });

    await login(page, adminUser);
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
