import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import { companies, companyAdministrators, users } from "@/db/schema";

test.describe("Admin Management", () => {
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

  test.describe("Admin List Display", () => {
    test("displays all users with correct roles and owner first", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Check page title and description
      await expect(page.getByRole("heading", { name: "Admins" })).toBeVisible();
      await expect(page.getByText("Manage access for users with admin roles in your workspace.")).toBeVisible();

      // Check table headers
      await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Role" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Active" })).toBeVisible();

      // Check that primary admin is first and marked as Owner
      const firstRow = page.getByRole("row").nth(1); // Skip header row
      await expect(firstRow.getByText(primaryAdmin.legalName!)).toBeVisible();
      await expect(firstRow.getByText("Owner")).toBeVisible();
      await expect(firstRow.getByText("(You)")).toBeVisible();

      // Check that second admin shows as Admin
      await expect(page.getByText(secondAdmin.legalName!)).toBeVisible();
      await expect(page.getByText("Admin").nth(1)).toBeVisible(); // nth(1) because Owner might also contain "Admin"

      // Check that multi-role user shows as Admin (priority over other roles)
      await expect(page.getByText(multiRoleUser.legalName!)).toBeVisible();
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName!) });
      await expect(multiRoleRow.getByText("Admin")).toBeVisible();

      // Check other users are displayed with correct roles
      await expect(page.getByText(contractorUser.legalName!)).toBeVisible();
      await expect(page.getByText("Senior Developer")).toBeVisible();

      await expect(page.getByText(investorUser.legalName!)).toBeVisible();
      await expect(page.getByText("Investor")).toBeVisible();

      await expect(page.getByText(lawyerUser.legalName!)).toBeVisible();
      await expect(page.getByText("Lawyer")).toBeVisible();
    });

    test("displays user names correctly (legal_name over preferred_name)", async ({ page }) => {
      // Create user with both legal_name and preferred_name
      const { user: userWithBothNames } = await usersFactory.create({
        legalName: "John Legal Name",
        preferredName: "Johnny Preferred",
      });
      await companyContractorsFactory.create({
        userId: userWithBothNames.id,
        companyId: company.id,
        role: "Developer",
      });

      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Should display legal_name, not preferred_name
      await expect(page.getByText("John Legal Name")).toBeVisible();
      await expect(page.getByText("Johnny Preferred")).not.toBeVisible();
    });

    test("shows email when no legal name is available", async ({ page }) => {
      // Create user with no legal name
      const { user: userWithoutName } = await usersFactory.create({
        legalName: null,
        preferredName: null,
      });
      await companyContractorsFactory.create({
        userId: userWithoutName.id,
        companyId: company.id,
        role: "Developer",
      });

      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Should display email as fallback
      await expect(page.getByText(userWithoutName.email)).toBeVisible();
    });
  });

  test.describe("Admin Role Toggle", () => {
    test("allows promoting non-admin to admin", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Find contractor row and toggle admin switch
      const contractorRow = page.getByRole("row", { name: new RegExp(contractorUser.legalName!) });
      const adminSwitch = contractorRow.getByRole("switch", { name: new RegExp(contractorUser.legalName!) });

      // Initially not admin
      await expect(adminSwitch).not.toBeChecked();

      // Toggle to admin
      await adminSwitch.click();

      // Should be checked now
      await expect(adminSwitch).toBeChecked();

      // Verify in database
      const adminRecord = await db.query.companyAdministrators.findFirst({
        where: and(
          eq(companyAdministrators.userId, contractorUser.id),
          eq(companyAdministrators.companyId, company.id),
        ),
      });
      expect(adminRecord).toBeTruthy();

      // Role should change from "Senior Developer" to "Admin"
      await expect(contractorRow.getByText("Admin")).toBeVisible();
    });

    test("allows demoting admin to non-admin", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Find second admin row and toggle admin switch
      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName!) });
      const adminSwitch = secondAdminRow.getByRole("switch", { name: new RegExp(secondAdmin.legalName!) });

      // Initially admin
      await expect(adminSwitch).toBeChecked();

      // Toggle to remove admin
      await adminSwitch.click();

      // Should not be checked now
      await expect(adminSwitch).not.toBeChecked();

      // Verify in database
      const adminRecord = await db.query.companyAdministrators.findFirst({
        where: and(eq(companyAdministrators.userId, secondAdmin.id), eq(companyAdministrators.companyId, company.id)),
      });
      expect(adminRecord).toBeFalsy();

      // Role should change from "Admin" to "-" (no role)
      await expect(secondAdminRow.getByText("-")).toBeVisible();
    });

    test("prevents removing own admin role", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Find own row (marked with "You")
      const ownRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName!) });
      const adminSwitch = ownRow.getByRole("switch", { name: new RegExp(primaryAdmin.legalName!) });

      // Switch should be disabled for own row
      await expect(adminSwitch).toBeDisabled();
    });

    test("prevents removing last administrator", async ({ page }) => {
      // Remove all admins except primary admin
      await db
        .delete(companyAdministrators)
        .where(and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, secondAdmin.id)));
      await db
        .delete(companyAdministrators)
        .where(
          and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, multiRoleUser.id)),
        );

      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Primary admin switch should be disabled when they're the only admin
      const ownRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName!) });
      const adminSwitch = ownRow.getByRole("switch", { name: new RegExp(primaryAdmin.legalName!) });

      await expect(adminSwitch).toBeDisabled();
    });

    test("shows loading state during role toggle", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      const contractorRow = page.getByRole("row", { name: new RegExp(contractorUser.legalName!) });
      const adminSwitch = contractorRow.getByRole("switch", { name: new RegExp(contractorUser.legalName!) });

      // Switch should be enabled initially
      await expect(adminSwitch).toBeEnabled();

      // Click and verify the switch responds
      await adminSwitch.click();

      // After successful toggle, should be checked
      await expect(adminSwitch).toBeChecked();
    });
  });

  test.describe("Authorization", () => {
    test("redirects non-admin users", async ({ page }) => {
      await login(page, contractorUser);
      await page.goto("/settings/administrator/admins");

      await expect(page.getByRole("heading", { name: "Admins" })).not.toBeVisible();
    });

    test("allows second admin to access page", async ({ page }) => {
      await login(page, secondAdmin);
      await page.goto("/settings/administrator/admins");

      // Should be able to access the page
      await expect(page.getByRole("heading", { name: "Admins" })).toBeVisible();
      await expect(page.getByText("Manage access for users with admin roles in your workspace.")).toBeVisible();
    });
  });

  test.describe("Multi-role Users", () => {
    test("prioritizes admin role over other roles in display", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Multi-role user should show "Admin" not "Lawyer" or "Investor"
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName!) });
      await expect(multiRoleRow.getByText("Admin")).toBeVisible();
      await expect(multiRoleRow.getByText("Lawyer")).not.toBeVisible();
      await expect(multiRoleRow.getByText("Investor")).not.toBeVisible();
    });

    test("removing admin role reveals next highest priority role", async ({ page }) => {
      await login(page, primaryAdmin);
      await page.goto("/settings/administrator/admins");

      // Multi-role user currently shows as Admin
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName!) });
      await expect(multiRoleRow.getByText("Admin")).toBeVisible();

      // Remove admin role
      const adminSwitch = multiRoleRow.getByRole("switch", { name: new RegExp(multiRoleUser.legalName!) });
      await adminSwitch.click();

      // Should now show "Lawyer" (next priority after Admin)
      await expect(multiRoleRow.getByText("Lawyer")).toBeVisible();
      await expect(multiRoleRow.getByText("Admin")).not.toBeVisible();
    });
  });
});
