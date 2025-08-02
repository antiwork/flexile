import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import { companies, companyAdministrators, users } from "@/db/schema";

test.describe("Manage roles access", () => {
  let company: typeof companies.$inferSelect;
  let primaryAdmin: typeof users.$inferSelect;
  let secondAdmin: typeof users.$inferSelect;
  let contractorUser: typeof users.$inferSelect;
  let investorUser: typeof users.$inferSelect;
  let lawyerUser: typeof users.$inferSelect;
  let multiRoleUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    // Create company with primary admin
    ({ company, adminUser: primaryAdmin } = await companiesFactory.createCompletedOnboarding());

    // Create second admin
    const { user: secondAdminUser } = await usersFactory.create({ legalName: "Second Admin" });
    await companyAdministratorsFactory.create({ userId: secondAdminUser.id, companyId: company.id });
    secondAdmin = secondAdminUser;

    // Create contractor
    const { user: contractorUserData } = await usersFactory.create({ legalName: "John Contractor" });
    await companyContractorsFactory.create({
      userId: contractorUserData.id,
      companyId: company.id,
      role: "Senior Developer",
    });
    contractorUser = contractorUserData;

    // Create investor
    const { user: investorUserData } = await usersFactory.create({ legalName: "Jane Investor" });
    await companyInvestorsFactory.create({ userId: investorUserData.id, companyId: company.id });
    investorUser = investorUserData;

    // Create lawyer
    const { user: lawyerUserData } = await usersFactory.create({ legalName: "Bob Lawyer" });
    await companyLawyersFactory.create({ userId: lawyerUserData.id, companyId: company.id });
    lawyerUser = lawyerUserData;

    // Create user with multiple roles (admin + investor + lawyer)
    const { user: multiRoleUserData } = await usersFactory.create({ legalName: "Alice MultiRole" });
    await companyAdministratorsFactory.create({ userId: multiRoleUserData.id, companyId: company.id });
    await companyInvestorsFactory.create({ userId: multiRoleUserData.id, companyId: company.id });
    await companyLawyersFactory.create({ userId: multiRoleUserData.id, companyId: company.id });
    multiRoleUser = multiRoleUserData;
  });

  test.describe("Roles List Display", () => {
    test("displays both admins and lawyers in combined table", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Wait for the page to be fully loaded
      await page.waitForLoadState("networkidle");

      // Add a more specific wait for the table to appear
      await page.waitForSelector("table", { timeout: 10000 });

      // Check page title and description
      await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
      await expect(page.getByText("Use roles to grant deeper access to your workspace.")).toBeVisible();

      // Check table headers - use more flexible selectors
      await expect(page.locator('th:has-text("Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Role")')).toBeVisible();

      // Check that primary admin is first and marked as Owner
      const firstRow = page.getByRole("row").nth(1); // Skip header row
      await expect(firstRow.getByText(primaryAdmin.legalName || "")).toBeVisible();
      await expect(firstRow.getByText("Owner")).toBeVisible();
      await expect(firstRow.getByText("(You)")).toBeVisible();

      // Check that second admin shows as Admin
      await expect(page.getByText(secondAdmin.legalName || "")).toBeVisible();
      await expect(page.getByText("Admin").nth(1)).toBeVisible(); // nth(1) because Owner might also contain "Admin"

      // Check that lawyer shows as Lawyer
      await expect(page.getByText(lawyerUser.legalName || "")).toBeVisible();
      await expect(page.getByText("Lawyer").nth(1)).toBeVisible();

      // Check that multi-role user shows as Admin
      await expect(page.getByText(multiRoleUser.legalName || "")).toBeVisible();
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName || "", "u") });
      await expect(multiRoleRow.getByRole("cell", { name: "Admin" })).toBeVisible();

      // Verify users with roles other than admin or lawyer are NOT displayed
      await expect(page.getByText(contractorUser.legalName || "")).not.toBeVisible();
      await expect(page.getByText("Senior Developer")).not.toBeVisible();
      await expect(page.getByText(investorUser.legalName || "")).not.toBeVisible();
      await expect(page.getByText("Investor")).not.toBeVisible();
    });

    test("displays admin names correctly (legal_name over preferred_name)", async ({ page }) => {
      // Create admin user with both legal_name and preferred_name
      const { user: adminWithBothNames } = await usersFactory.create({
        legalName: "John Legal Name",
        preferredName: "Johnny Preferred",
      });
      await companyAdministratorsFactory.create({
        userId: adminWithBothNames.id,
        companyId: company.id,
      });

      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Should display legal_name, not preferred_name
      await expect(page.getByText("John Legal Name")).toBeVisible();
      await expect(page.getByText("Johnny Preferred")).not.toBeVisible();
    });

    test("shows email when admin has no legal name", async ({ page }) => {
      // Create admin user with no legal name
      const { user: adminWithoutName } = await usersFactory.create({
        legalName: null,
        preferredName: null,
      });
      await companyAdministratorsFactory.create({
        userId: adminWithoutName.id,
        companyId: company.id,
      });

      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Should display email as fallback (use first occurrence)
      await expect(page.getByText(adminWithoutName.email).first()).toBeVisible();
    });

    test("search functionality works for names", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Wait for page to load
      await page.waitForLoadState("networkidle");

      // Find search input
      const searchInput = page.getByPlaceholder("Search by name...");
      await expect(searchInput).toBeVisible();

      // Search for specific user
      await searchInput.fill(secondAdmin.legalName || "");

      // Should show only that user
      await expect(page.getByText(secondAdmin.legalName || "")).toBeVisible();
      await expect(page.getByText(primaryAdmin.legalName || "")).not.toBeVisible();
      await expect(page.getByText(lawyerUser.legalName || "")).not.toBeVisible();

      // Clear search
      await searchInput.clear();

      // Should show all users again
      await expect(page.getByText(primaryAdmin.legalName || "")).toBeVisible();
      await expect(page.getByText(secondAdmin.legalName || "")).toBeVisible();
      await expect(page.getByText(lawyerUser.legalName || "")).toBeVisible();
    });
  });

  test.describe("Admin Role Revoke", () => {
    test("allows revoking admin access", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Find second admin row and click ellipsis menu
      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName || "", "u") });
      const ellipsisButton = secondAdminRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      // Click "Remove admin" in dropdown
      await page.getByRole("menuitem", { name: "Remove admin" }).click();

      // Confirm in modal
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText(/Remove admin access for/u)).toBeVisible();

      // Set up promise to wait for the tRPC mutation response
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes("trpc/companies.removeRole") && response.status() === 200,
      );

      // Click the button
      await page.getByRole("button", { name: "Remove admin" }).click();

      // Wait for the row in the table to be removed, not just any text
      await expect(page.getByRole("row", { name: new RegExp(secondAdmin.legalName || "", "u") })).not.toBeVisible();

      // Wait for the actual backend response
      await responsePromise;

      // Verify in database
      const adminRecord = await db.query.companyAdministrators.findFirst({
        where: and(eq(companyAdministrators.userId, secondAdmin.id), eq(companyAdministrators.companyId, company.id)),
      });
      expect(adminRecord).toBeFalsy();
    });

    test("prevents removing own admin role", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Owner role should not have any action button
      const ownRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName || "", "u") });
      await expect(ownRow.getByRole("button", { name: "Open menu" })).not.toBeVisible();
    });

    test("disables action for non-owner current user", async ({ page }) => {
      await login(page, secondAdmin);
      await page.goto("/settings/administrator/roles");

      // Find own row (marked with "You")
      const ownRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName || "", "u") });
      const ellipsisButton = ownRow.getByRole("button", { name: "Open menu" });

      // Button should be disabled for own row
      await expect(ellipsisButton).toBeDisabled();
    });

    test("prevents removing last administrator", async ({ page }) => {
      // Remove all admins except primary admin and second admin
      await db
        .delete(companyAdministrators)
        .where(
          and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, multiRoleUser.id)),
        );

      await login(page, secondAdmin);
      await page.goto("/settings/administrator/roles");

      // Primary admin (owner) should not have action button
      const ownerRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName || "", "u") });
      await expect(ownerRow.getByRole("button", { name: "Open menu" })).not.toBeVisible();

      // Second admin should have disabled button when they would be removing the last non-owner admin
      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName || "", "u") });
      const ellipsisButton = secondAdminRow.getByRole("button", { name: "Open menu" });
      await expect(ellipsisButton).toBeDisabled();
    });

    test("shows button state during revoke", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName || "", "u") });
      const ellipsisButton = secondAdminRow.getByRole("button", { name: "Open menu" });

      // Button should be enabled initially
      await expect(ellipsisButton).toBeEnabled();

      // Click menu and remove admin
      await ellipsisButton.click();
      await page.getByRole("menuitem", { name: "Remove admin" }).click();
      await page.getByRole("button", { name: "Remove admin" }).click();

      // Row should be removed from the list
      await expect(page.getByRole("row", { name: new RegExp(secondAdmin.legalName || "", "u") })).not.toBeVisible();
    });
  });

  test.describe("Lawyer Role Management", () => {
    test("allows revoking lawyer access", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Find lawyer row and click ellipsis menu
      const lawyerRow = page.getByRole("row", { name: new RegExp(lawyerUser.legalName || "", "u") });
      const ellipsisButton = lawyerRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      // Click "Remove lawyer" in dropdown
      await page.getByRole("menuitem", { name: "Remove lawyer" }).click();

      // Confirm in modal
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText(/Remove lawyer access for/u)).toBeVisible();

      // Set up promise to wait for the tRPC mutation response
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes("trpc/companies.removeRole") && response.status() === 200,
      );

      // Click the button
      await page.getByRole("button", { name: "Remove lawyer" }).click();

      // Wait for row to be removed (optimistic update)
      await expect(page.getByRole("row", { name: new RegExp(lawyerUser.legalName || "", "u") })).not.toBeVisible();

      // Wait for the actual backend response
      await responsePromise;
    });

    test("shows remove admin option for multi-role user when they have admin role", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Multi-role user should show "Admin" role
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName || "", "u") });
      await expect(multiRoleRow.getByRole("cell", { name: "Admin" })).toBeVisible();

      // Should have "Remove admin" option
      const ellipsisButton = multiRoleRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      await expect(page.getByRole("menuitem", { name: "Remove admin" })).toBeVisible();
    });
  });

  test.describe("Authorization", () => {
    test("redirects non-admin users", async ({ page }) => {
      await login(page, contractorUser);
      await page.goto("/settings/administrator/roles");

      await expect(page.getByRole("heading", { name: "Roles" })).not.toBeVisible();
    });

    test("allows second admin to access page", async ({ page }) => {
      await login(page, secondAdmin);
      await page.goto("/settings/administrator/roles");

      // Should be able to access the page
      await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
      await expect(page.getByText("Use roles to grant deeper access to your workspace.")).toBeVisible();
    });
  });

  test.describe("Multi-role Users", () => {
    test("shows multi-role users as Admin when they have both admin and lawyer roles", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Multi-role user should show "Admin" role
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName || "", "u") });
      await expect(multiRoleRow.getByRole("cell", { name: "Admin" })).toBeVisible();
    });

    test("removes multi-role user from list when admin role is revoked", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/roles");

      // Multi-role user currently shows as Admin
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName || "", "u") });
      await expect(multiRoleRow.getByRole("cell", { name: "Admin" })).toBeVisible();

      // Revoke admin role
      const ellipsisButton = multiRoleRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();
      await page.getByRole("menuitem", { name: "Remove admin" }).click();

      // Set up promise to wait for the tRPC mutation response
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes("trpc/companies.removeRole") && response.status() === 200,
      );

      await page.getByRole("button", { name: "Remove admin" }).click();

      // Wait for row to be updated (optimistic update)
      await expect(multiRoleRow.getByRole("cell", { name: "Admin" })).not.toBeVisible();

      // Wait for the actual backend response
      await responsePromise;

      // User should now show as Lawyer only
      const updatedMultiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName || "", "u") });
      await expect(updatedMultiRoleRow.getByRole("cell", { name: "Lawyer" })).toBeVisible();
      await expect(updatedMultiRoleRow.getByRole("cell", { name: "Admin" })).not.toBeVisible();
    });
  });
});

test.describe("Roles page invite functionality", () => {
  test("should be able to invite admin by email", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.goto("/settings/administrator/roles");

    await page.getByRole("button", { name: "Add member" }).click();

    await page.getByRole("combobox").filter({ hasText: "Search by name or enter email" }).click();
    await page.getByPlaceholder("Search by name or enter email...").fill("testadmin@example.com");
    await page.getByRole("option", { name: "Invite testadmin@example.com" }).click();

    await selectComboboxOption(page, "Role", "Admin");

    await page.getByRole("button", { name: "Add member" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("should be able to invite lawyer by email", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.goto("/settings/administrator/roles");

    await page.getByRole("button", { name: "Add member" }).click();

    await page.getByRole("combobox").filter({ hasText: "Search by name or enter email" }).click();
    await page.getByPlaceholder("Search by name or enter email...").fill("testlawyer@example.com");
    await page.getByRole("option", { name: "Invite testlawyer@example.com" }).click();

    await selectComboboxOption(page, "Role", "Lawyer");

    await page.getByRole("button", { name: "Add member" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("should show proper form validation", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.goto("/settings/administrator/roles");

    await page.getByRole("button", { name: "Add member" }).click();

    await expect(page.getByRole("button", { name: "Add member" })).toBeDisabled();

    await page.getByRole("combobox").filter({ hasText: "Search by name or enter email" }).click();
    await page.getByPlaceholder("Search by name or enter email...").fill("invalid_name");

    await expect(
      page.getByText("Please select a valid member from the list or enter a valid email address"),
    ).toBeVisible();
  });
});
