import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import {
  companies,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyLawyers,
  users,
} from "@/db/schema";

// HELPERS
interface Count {
  ui?: number;
  db?: number;
}

interface ExpectedRoleCounts {
  admins?: Count;
  lawyers?: Count;
  contractors?: Count;
  investors?: Count;
  totalUsersInTable?: Count;
}

async function expectUserByRolesToBe(page: Page, companyId: bigint, expected: ExpectedRoleCounts): Promise<void> {
  if (expected.admins?.ui) {
    await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Admin" })).toHaveCount(expected.admins.ui);
  }
  if (expected.lawyers?.ui) {
    await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Lawyer" })).toHaveCount(expected.lawyers.ui);
  }
  if (expected.totalUsersInTable?.ui) {
    await expect(page.getByRole("row")).toHaveCount(expected.totalUsersInTable.ui + 1);
  }

  const dbRecords = await Promise.all([
    expected.admins?.db
      ? db.query.companyAdministrators.findMany({
          where: eq(companyAdministrators.companyId, companyId),
        })
      : Promise.resolve([]),
    expected.lawyers?.db
      ? db.query.companyLawyers.findMany({ where: eq(companyLawyers.companyId, companyId) })
      : Promise.resolve([]),
    expected.contractors?.db
      ? db.query.companyContractors.findMany({ where: eq(companyContractors.companyId, companyId) })
      : Promise.resolve([]),
    expected.investors?.db
      ? db.query.companyInvestors.findMany({ where: eq(companyInvestors.companyId, companyId) })
      : Promise.resolve([]),
  ]);

  if (expected.admins?.db) {
    expect(dbRecords[0].length).toBe(expected.admins.db);
  }
  if (expected.lawyers?.db) {
    expect(dbRecords[1].length).toBe(expected.lawyers.db);
  }
  if (expected.contractors?.db) {
    expect(dbRecords[2].length).toBe(expected.contractors.db);
  }
  if (expected.investors?.db) {
    expect(dbRecords[3].length).toBe(expected.investors.db);
  }
}

test.describe("Manage workspace roles", () => {
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

    // Initial count for reference
    // expectUserByRolesToBe(page, company.id, {
    //   admins: {
    //     ui: 2, // Owner is not counted as admin
    //     db: 3,
    //   },
    //   contractors: {
    //     ui: 0,
    //     db: 1,
    //   },
    //   investors: {
    //     ui: 0,
    //     db: 2,
    //   },
    //   lawyers: {
    //     ui: 1,
    //     db: 2,
    //   },
    //   totalUsersInTable: {
    //     ui: 4,
    //   },
    // });
  });

  test.describe("Add Member", () => {
    test("adds existing contractor as admin", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();
      const listBox = page.locator('[role="listbox"]');

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      // Fill the form & submit
      await page.getByRole("combobox").first().click();
      await expect(listBox).toBeVisible();
      await page.getByPlaceholder("Search by name or invite by email...").fill(contractorUser.legalName ?? "");
      await page.getByRole("option", { name: `${contractorUser.legalName} ${contractorUser.email}` }).click();
      await expect(listBox).toBeHidden();

      await page.getByRole("combobox").nth(1).click();
      await expect(listBox).toBeVisible();
      await page.getByRole("option", { name: "Admin" }).click();
      await expect(listBox).toBeHidden();

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // Verify data changes
      const contractorRow = page.getByRole("row", { name: new RegExp(contractorUser.legalName ?? "", "u") });
      await expect(contractorRow.locator('[data-slot="badge"]').getByText("Admin")).toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 3, db: 4 },
        contractors: { db: 1 },
        investors: { db: 2 },
        lawyers: { ui: 1, db: 2 },
        totalUsersInTable: { ui: 5 },
      });
    });

    test("adds existing investor as lawyer", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();
      const listBox = page.locator('[role="listbox"]');

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      // Fill the form & submit
      await page.getByRole("combobox").first().click();
      await expect(listBox).toBeVisible();
      await page.getByPlaceholder("Search by name or invite by email...").fill(investorUser.legalName ?? "");
      await page.getByRole("option", { name: `${investorUser.legalName} ${investorUser.email}` }).click();
      await expect(listBox).toBeHidden();

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // Verify data changes
      const contractorRow = page.getByRole("row", { name: new RegExp(investorUser.legalName ?? "", "u") });
      await expect(contractorRow.locator('[data-slot="badge"]').getByText("Lawyer")).toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 2, db: 3 },
        contractors: { db: 1 },
        investors: { db: 2 },
        lawyers: { ui: 2, db: 3 },
        totalUsersInTable: { ui: 5 },
      });
    });

    test("allows searching by name or email", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or invite by email...");
      await expect(page.getByPlaceholder("Search by name or email...")).toBeVisible();
      const listBox = page.locator('[role="listbox"]');

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const contractorOption = page.getByRole("option", {
        name: `${contractorUser.legalName} ${contractorUser.email}`,
      });
      const lawyerOption = page.getByRole("option", {
        name: `${lawyerUser.legalName} ${lawyerUser.email}`,
      });
      const adminOption = page.getByRole("option", {
        name: `${secondAdmin.legalName} ${secondAdmin.email}`,
      });
      const investorOption = page.getByRole("option", {
        name: `${investorUser.legalName} ${investorUser.email}`,
      });

      await page.getByRole("combobox").first().click();
      await expect(listBox).toBeVisible();

      // All users should be present again
      await expect(adminOption).not.toBeAttached();
      await expect(contractorOption).toBeAttached();
      await expect(investorOption).toBeAttached();
      await expect(lawyerOption).not.toBeAttached();

      // matches by name
      await searchInput.fill(contractorUser.legalName ?? "");
      await expect(adminOption).not.toBeAttached();
      await expect(contractorOption).toBeAttached();
      await expect(investorOption).not.toBeAttached();
      await expect(lawyerOption).not.toBeAttached();

      // matches by email
      await searchInput.fill(investorUser.email);
      await expect(adminOption).not.toBeAttached();
      await expect(contractorOption).not.toBeAttached();
      await expect(investorOption).toBeAttached();
      await expect(lawyerOption).not.toBeAttached();
    });

    test("displays form validation errors", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();
      const listBox = page.locator('[role="listbox"]');

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const comboBox = page.getByRole("combobox").first();
      const placeholder = page.getByPlaceholder("Search by name or invite by email...").first();

      // Selection required
      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByText("Required")).toBeVisible();

      await comboBox.click();
      await placeholder.fill("invalid-email");
      await expect(listBox).toBeVisible();
      await page.getByRole("option", { name: "invalid-email", exact: true }).click();
      await expect(listBox).toBeHidden();

      // Invalid email address
      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByText("Please enter a valid email address")).toBeVisible();

      await comboBox.click();
      await placeholder.fill(secondAdmin.email);
      await expect(listBox).toBeVisible();
      await page.getByRole("option", { name: secondAdmin.email, exact: true }).click();
      await expect(listBox).toBeHidden();

      // Disallows invitation for roled members
      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByText("Cannot invite members with a role assigned")).toBeVisible();
    });

    test("does not have admins or lawyers in search list", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      await page.getByRole("combobox").first().click();
      await expect(page.locator('[role="listbox"]')).toBeVisible();

      await expect(
        page.getByRole("option", {
          name: `${primaryAdmin.legalName} ${primaryAdmin.email}`,
        }),
      ).not.toBeAttached();
      await expect(
        page.getByRole("option", {
          name: `${secondAdmin.legalName} ${secondAdmin.email}`,
        }),
      ).not.toBeAttached();
      await expect(
        page.getByRole("option", {
          name: `${multiRoleUser.legalName} ${multiRoleUser.email}`,
        }),
      ).not.toBeAttached();
      await expect(
        page.getByRole("option", {
          name: `${lawyerUser.legalName} ${lawyerUser.email}`,
        }),
      ).not.toBeAttached();
    });

    test("invites new user as admin via email", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();
      const listBox = page.locator('[role="listbox"]');

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const newAdminEmail = "new@admin.com";

      // Fill the form & submit
      await page.getByRole("combobox").first().click();
      await expect(listBox).toBeVisible();

      await page.getByPlaceholder("Search by name or invite by email...").fill(newAdminEmail);
      await page.getByRole("option", { name: newAdminEmail }).click();
      await expect(listBox).toBeHidden();

      await page.getByRole("combobox").nth(1).click();
      await expect(listBox).toBeVisible();
      await page.getByRole("option", { name: "Admin" }).click();
      await expect(listBox).toBeHidden();

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // Displayed with invited status
      await expect(page.getByText(`${newAdminEmail} (Invited)`)).toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 3, db: 4 },
        contractors: { db: 1 },
        investors: { db: 2 },
        lawyers: { ui: 1, db: 2 },
        totalUsersInTable: { ui: 5 },
      });
    });

    test("invites new user as lawyer via email", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();
      const listBox = page.locator('[role="listbox"]');

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const newLawyerEmail = "new@lawyer.com";

      // Fill the form & submit
      await page.getByRole("combobox").first().click();
      await expect(listBox).toBeVisible();

      await page.getByPlaceholder("Search by name or invite by email...").fill(newLawyerEmail);
      await page.getByRole("option", { name: newLawyerEmail }).click();
      await expect(listBox).toBeHidden();

      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // Displayed with invited status
      await expect(page.getByText(`${newLawyerEmail} (Invited)`)).toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 2, db: 3 },
        contractors: { db: 1 },
        investors: { db: 2 },
        lawyers: { ui: 2, db: 3 },
        totalUsersInTable: { ui: 5 },
      });
    });
  });

  test.describe("Admin List", () => {
    test("allows searching by name or email on ", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const searchInput = page.getByPlaceholder("Search by name or email...");
      await expect(searchInput).toBeVisible();

      await searchInput.fill(secondAdmin.legalName ?? "");

      // displays only matched user
      await expect(page.getByText(secondAdmin.legalName ?? "")).toBeVisible();
      await expect(page.getByText(lawyerUser.legalName ?? "")).not.toBeVisible();
      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 1 },
        lawyers: { ui: 0 },
        totalUsersInTable: { ui: 1 },
      });

      await searchInput.fill("");

      // displays all users
      await expect(page.getByText(secondAdmin.legalName ?? "")).toBeVisible();
      await expect(page.getByText(lawyerUser.legalName ?? "")).toBeVisible();
      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 2 },
        lawyers: { ui: 1 },
        totalUsersInTable: { ui: 4 },
      });

      await searchInput.fill(secondAdmin.email);

      await expect(page.getByText(secondAdmin.legalName ?? "")).toBeVisible();
      await expect(page.getByText(lawyerUser.legalName ?? "")).not.toBeVisible();
      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 1 },
        lawyers: { ui: 0 },
        totalUsersInTable: { ui: 1 },
      });
    });
    test("displays all workspace members with owner first", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      // Wait for the page to be fully loaded
      await page.waitForLoadState("networkidle");

      // Check page title and description
      await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
      await expect(page.getByText("Use roles to grant deeper access to your workspace.")).toBeVisible();

      // Check table headers
      await expect(page.locator('th:has-text("Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Role")')).toBeVisible();

      // Check that primary admin is first and marked as Owner
      const firstRow = page.getByRole("row").nth(1); // Skip header row
      await expect(firstRow.getByText(primaryAdmin.legalName ?? "")).toBeVisible();
      await expect(firstRow.getByText("Owner")).toBeVisible();
      await expect(firstRow.getByText("(You)")).toBeVisible();

      // Check that second admin shows as Admin
      await expect(page.getByText(secondAdmin.legalName ?? "")).toBeVisible();
      await expect(page.getByText("Admin").nth(1)).toBeVisible(); // nth(1) because Owner might also contain "Admin"

      // Check that lawyer shows as Lawyer
      await expect(page.getByText(lawyerUser.legalName ?? "")).toBeVisible();
      const lawyerRow = page.getByRole("row", { name: new RegExp(lawyerUser.legalName ?? "", "u") });
      await expect(lawyerRow.locator('[data-slot="badge"]').getByText("Lawyer")).toBeVisible();

      // Check that multi-role user shows as Admin (highest role)
      await expect(page.getByText(multiRoleUser.legalName ?? "")).toBeVisible();
      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName ?? "", "u") });
      await expect(multiRoleRow.getByText("Admin")).toBeVisible();

      // Unprivileged users should not be displayed (contractors, investors, etc.)
      await expect(page.getByText(contractorUser.legalName ?? "")).not.toBeVisible();
      await expect(page.getByText(investorUser.legalName ?? "")).not.toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 2, db: 3 },
        contractors: { db: 1 },
        investors: { db: 2 },
        lawyers: { ui: 1, db: 2 },
        totalUsersInTable: { ui: 4 },
      });
    });

    test("displays user names correctly (legal_name over preferred_name)", async ({ page }) => {
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
    });

    test("shows email when user has no legal name", async ({ page }) => {
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

      // Wait for the page to be fully loaded
      await page.waitForLoadState("networkidle");
      await page.waitForSelector("table", { timeout: 10000 });

      // Should display email as fallback in the user's row
      const userRow = page.getByRole("row", { name: adminWithoutName.email });
      await expect(userRow).toBeVisible();
    });
  });

  test.describe("Authorization", () => {
    test("allows second admin to access page", async ({ page }) => {
      await login(page, secondAdmin, "/settings/administrator/roles");

      await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
      await expect(page.getByText("Use roles to grant deeper access to your workspace.")).toBeVisible();
    });

    test("redirects non-admin users", async ({ page }) => {
      await login(page, contractorUser, "/settings/administrator/roles");

      await expect(page.getByRole("heading", { name: "Roles" })).not.toBeVisible();
    });
  });

  test.describe("Role Management", () => {
    test("allows changing role from Admin to Lawyer", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      // Find second admin row and click ellipsis menu
      const multiAdminRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName ?? "", "u") });
      const ellipsisButton = multiAdminRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      await page.getByRole("menuitem", { name: "Make Lawyer" }).click();

      await expect(multiAdminRow.getByText("Lawyer")).toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 1, db: 2 },
        lawyers: { ui: 2, db: 2 },
        investors: { db: 2 },
      });
    });

    test("allows changing role from Lawyer to Admin", async ({ page }) => {
      await login(page, secondAdmin, "/settings/administrator/roles");

      // Find lawyer row and click ellipsis menu
      const lawyerRow = page.getByRole("row", { name: new RegExp(lawyerUser.legalName ?? "", "u") });
      const ellipsisButton = lawyerRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      await page.getByRole("menuitem", { name: "Make Admin" }).click();

      await expect(lawyerRow.getByText("Admin")).toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 3, db: 4 },
        lawyers: { ui: 0, db: 1 },
        investors: { db: 2 },
      });
    });

    test("allows revoking admin access", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      // Find second admin row and click ellipsis menu
      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName ?? "", "u") });
      const ellipsisButton = secondAdminRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      await page.getByRole("menuitem", { name: "Revoke Role" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText(/Remove admin access for/u)).toBeVisible();

      await page.getByRole("button", { name: "Remove admin" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // User should be removed from the list since they have no other company relationships
      await expect(page.getByText(secondAdmin.legalName ?? "")).not.toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 1, db: 2 },
        lawyers: { ui: 1, db: 2 },
        investors: { db: 2 },
      });

      const adminRecord = await db.query.companyAdministrators.findFirst({
        where: and(eq(companyAdministrators.userId, secondAdmin.id), eq(companyAdministrators.companyId, company.id)),
      });
      expect(adminRecord).toBeFalsy();
    });

    test("allows revoking lawyer access", async ({ page }) => {
      await login(page, secondAdmin, "/settings/administrator/roles");

      // Find lawyer row and click ellipsis menu
      const lawyerRow = page.getByRole("row", { name: new RegExp(lawyerUser.legalName ?? "", "u") });
      const ellipsisButton = lawyerRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();

      await page.getByRole("menuitem", { name: "Revoke Role" }).click();

      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText(/Remove lawyer access for/u)).toBeVisible();

      await page.getByRole("button", { name: "Remove lawyer" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await expect(page.getByText(lawyerUser.legalName ?? "")).not.toBeVisible();

      await expectUserByRolesToBe(page, company.id, {
        admins: { ui: 2, db: 3 },
        lawyers: { ui: 0, db: 1 },
        investors: { db: 2 },
      });
    });

    test("displays role badges with proper styling and variants", async ({ page }) => {
      await login(page, secondAdmin, "/settings/administrator/roles");

      await page.waitForSelector("table");

      const ownerRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName ?? "", "u") });
      const ownerBadge = ownerRow.locator('[data-slot="badge"]').getByText("Owner");
      await expect(ownerBadge).toBeVisible();
      await expect(ownerBadge).toHaveClass(/bg-primary/u);

      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName ?? "", "u") });
      const adminBadge = multiRoleRow.locator('[data-slot="badge"]').getByText("Admin");
      await expect(adminBadge).toBeVisible();
      await expect(adminBadge).toHaveClass(/border/u);

      const lawyerRow = page.getByRole("row", { name: new RegExp(lawyerUser.legalName ?? "", "u") });
      const lawyerBadge = lawyerRow.locator('[data-slot="badge"]').getByText("Lawyer");
      await expect(lawyerBadge).toBeVisible();
      await expect(lawyerBadge).toHaveClass(/bg-secondary/u);
    });

    test("prevents removing last administrator", async ({ page }) => {
      // Remove all admins except primary admin and second admin
      await db
        .delete(companyAdministrators)
        .where(
          and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, multiRoleUser.id)),
        );

      await login(page, secondAdmin, "/settings/administrator/roles");

      await expect(page.locator('th:has-text("Name")')).toBeVisible();

      // Primary admin (owner) should not have action button
      const ownerRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName ?? "", "u") });
      await expect(ownerRow.getByRole("button", { name: "Open menu" })).not.toBeVisible();

      // Second admin should have disabled button when they would be removing the last non-owner admin
      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName ?? "", "u") });
      await expect(secondAdminRow.getByRole("button", { name: "Open menu" })).toBeDisabled();
    });

    test("prevents admin from removing owner & self", async ({ page }) => {
      await login(page, multiRoleUser, "/settings/administrator/roles");

      await expect(page.locator('th:has-text("Name")')).toBeVisible();

      // Owner role should not have any action button
      const ownerRow = page.getByRole("row", { name: new RegExp(primaryAdmin.legalName ?? "", "u") });
      await expect(ownerRow.getByRole("button", { name: "Open menu" })).not.toBeVisible();

      const secondAdminRow = page.getByRole("row", { name: new RegExp(secondAdmin.legalName ?? "", "u") });
      await expect(secondAdminRow.getByRole("button", { name: "Open menu" })).toBeEnabled();

      // Self role should not have any action button
      const selfRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName ?? "", "u") });
      await expect(selfRow.getByRole("button", { name: "Open menu" })).toBeDisabled();
    });

    test("shows multi-role users with highest role", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName ?? "", "u") });
      await expect(multiRoleRow.locator('[data-slot="badge"]').getByText("Admin")).toBeVisible();
    });

    test("updates multi-role user admin role is revoked", async ({ page }) => {
      await login(page, primaryAdmin, "/settings/administrator/roles");

      const multiRoleRow = page.getByRole("row", { name: new RegExp(multiRoleUser.legalName ?? "", "u") });
      const ellipsisButton = multiRoleRow.getByRole("button", { name: "Open menu" });
      await ellipsisButton.click();
      await page.getByRole("menuitem", { name: "Revoke Role" }).click();

      // Set up promise to wait for the tRPC mutation response
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes("trpc/companies.deleteWorkspaceMemberRole") && response.status() === 200,
      );

      await page.getByRole("button", { name: "Remove admin" }).click();

      // Wait for the actual backend response
      await responsePromise;

      await expect(page.getByText(multiRoleUser.legalName ?? "")).toHaveCount(0);
      await expectUserByRolesToBe(page, company.id, {
        admins: {
          ui: 1,
          db: 2,
        },
        lawyers: {
          ui: 1,
          db: 1,
        },
        investors: {
          db: 2,
        },
        contractors: {
          db: 1,
        },
        totalUsersInTable: {
          ui: 3,
        },
      });
    });
  });
});
