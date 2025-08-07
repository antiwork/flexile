import { expect, test } from "@playwright/test";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { login } from "@test/helpers/auth";
import { withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { companyUpdates } from "@/db/schema";

test.describe("recipient selector for company updates", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding();
    company = result.company;
    adminUser = result.adminUser;

    // Add various types of recipients
    await companyInvestorsFactory.create({ companyId: company.id });
    await companyInvestorsFactory.create({ companyId: company.id });

    // Add another admin
    await companyAdministratorsFactory.create({ companyId: company.id });

    // Add active contractors
    await companyContractorsFactory.create({ companyId: company.id });
    await companyContractorsFactory.create({ companyId: company.id });

    // Add alumni contractors (inactive)
    await companyContractorsFactory.createInactive({ companyId: company.id });
  });

  test("displays recipient selector at the top of the form", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();
    await expect(page.getByRole("dialog", { name: "New company update" })).toBeVisible();

    await withinModal(
      async (modal) => {
        // Should show default selected recipients (investors and active contractors) as badges
        const badges = modal.locator('[role="group"]').first();
        await expect(badges.getByText("Investors")).toBeVisible();
        await expect(badges.getByText("Active contractors")).toBeVisible();
      },
      { page, title: "New company update" },
    );
  });

  test("allows selecting and deselecting recipient types", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Open dropdown
        const dropdownButton = modal.locator("button").filter({ hasText: "Recipients" });
        await dropdownButton.click();

        // Check that dropdown is open and shows all options
        const menu = page.locator('[role="menu"]');
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("menuitem", { name: /Admins/u })).toBeVisible();
        await expect(menu.getByRole("menuitem", { name: /Investors/u })).toBeVisible();
        await expect(menu.getByRole("menuitem", { name: /Active contractors/u })).toBeVisible();
        await expect(menu.getByRole("menuitem", { name: /Alumni contractors/u })).toBeVisible();

        // Deselect investors
        await menu.getByRole("menuitem", { name: /Investors/u }).click();
        await expect(modal.getByText("Investors")).not.toBeVisible();

        // Select admins
        await menu.getByRole("menuitem", { name: /Admins/u }).click();
        await expect(modal.getByText("Admins")).toBeVisible();

        // Select alumni contractors
        await menu.getByRole("menuitem", { name: /Alumni contractors/u }).click();
        await expect(modal.getByText("Alumni contractors")).toBeVisible();

        // Close dropdown
        await modal.locator('[contenteditable="true"]').click();
        await expect(menu).not.toBeVisible();
      },
      { page, title: "New company update" },
    );
  });

  test("displays recipient counts in dropdown", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Open dropdown
        const dropdownButton = modal.locator("button").filter({ hasText: "Recipients" });
        await dropdownButton.click();

        const menu = page.locator('[role="menu"]');

        // Check that counts are displayed (right-aligned)
        const adminItem = menu.getByRole("menuitem", { name: /Admins/u });
        await expect(adminItem).toContainText("2"); // 2 admins

        const investorItem = menu.getByRole("menuitem", { name: /Investors/u });
        await expect(investorItem).toContainText("2"); // 2 investors

        const activeItem = menu.getByRole("menuitem", { name: /Active contractors/u });
        await expect(activeItem).toContainText("2"); // 2 active contractors

        const alumniItem = menu.getByRole("menuitem", { name: /Alumni contractors/u });
        await expect(alumniItem).toContainText("1"); // 1 alumni contractor
      },
      { page, title: "New company update" },
    );
  });

  test("allows removing recipients with keyboard (Delete/Backspace)", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Should have default recipients
        await expect(modal.getByText("Investors")).toBeVisible();
        await expect(modal.getByText("Active contractors")).toBeVisible();

        // Focus on a badge and press Delete
        const investorsBadge = modal.getByRole("button").filter({ hasText: "Investors" }).filter({ hasText: "×" });
        await investorsBadge.focus();
        await page.keyboard.press("Delete");
        await expect(modal.getByText("Investors")).not.toBeVisible();

        // Focus on another badge and press Backspace
        const contractorsBadge = modal
          .getByRole("button")
          .filter({ hasText: "Active contractors" })
          .filter({ hasText: "×" });
        await contractorsBadge.focus();
        await page.keyboard.press("Backspace");
        await expect(modal.getByText("Active contractors")).not.toBeVisible();
      },
      { page, title: "New company update" },
    );
  });

  test("allows removing recipients by clicking X button", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Should have default recipients
        await expect(modal.getByText("Investors")).toBeVisible();
        await expect(modal.getByText("Active contractors")).toBeVisible();

        // Click X button on Investors badge
        const investorsBadge = modal.getByRole("button").filter({ hasText: "Investors" }).filter({ hasText: "×" });
        await investorsBadge.locator("svg").click();
        await expect(modal.getByText("Investors")).not.toBeVisible();
      },
      { page, title: "New company update" },
    );
  });

  test("saves selected recipients when publishing update", async ({ page }) => {
    const title = "Update with custom recipients";
    const content = "This update has custom recipients";

    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Modify recipients - remove investors, add admins
        const dropdownButton = modal.locator("button").filter({ hasText: "Recipients" });
        await dropdownButton.click();

        const menu = page.locator('[role="menu"]');
        await menu.getByRole("menuitem", { name: /Investors/u }).click(); // Deselect
        await menu.getByRole("menuitem", { name: /Admins/u }).click(); // Select

        // Close dropdown
        await modal.locator('[contenteditable="true"]').click();

        // Fill in the form
        await modal.getByLabel("Title").fill(title);
        await modal.locator('[contenteditable="true"]').fill(content);

        // Publish
        await modal.getByRole("button", { name: "Publish" }).click();
      },
      { page, title: "New company update" },
    );

    await expect(page.getByRole("dialog", { name: "Publish update?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, publish" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify the update was created with correct recipient types
    const updates = await db.query.companyUpdates.findMany({
      where: eq(companyUpdates.companyId, company.id),
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.recipientTypes).toEqual(["admins", "active_contractors"]);
  });

  test("shows checkmarks for selected recipients in dropdown", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Open dropdown
        const dropdownButton = modal.locator("button").filter({ hasText: "Recipients" });
        await dropdownButton.click();

        const menu = page.locator('[role="menu"]');

        // Investors and Active contractors should have checkmarks (default selected)
        const investorItem = menu.getByRole("menuitem", { name: /Investors/u });
        await expect(investorItem.locator("svg")).toBeVisible(); // Check icon

        const activeItem = menu.getByRole("menuitem", { name: /Active contractors/u });
        await expect(activeItem.locator("svg")).toBeVisible(); // Check icon

        // Admins and Alumni should not have checkmarks
        const adminItem = menu.getByRole("menuitem", { name: /Admins/u });
        await expect(adminItem.locator("svg")).not.toBeVisible();

        const alumniItem = menu.getByRole("menuitem", { name: /Alumni contractors/u });
        await expect(alumniItem.locator("svg")).not.toBeVisible();
      },
      { page, title: "New company update" },
    );
  });

  test("retains recipient selection when editing update", async ({ page }) => {
    // Create an update with specific recipients
    await db
      .insert(companyUpdates)
      .values({
        companyId: company.id,
        title: "Existing Update",
        body: "<p>Content</p>",
        recipientTypes: ["admins", "alumni_contractors"],
        sentAt: new Date(),
      })
      .returning();

    await login(page, adminUser);
    await page.goto("/updates/company");

    // Click on the update to edit
    await page.getByRole("row").filter({ hasText: "Existing Update" }).click();

    await withinModal(
      async (modal) => {
        // Check that the correct recipients are selected
        await expect(modal.getByText("Admins")).toBeVisible();
        await expect(modal.getByText("Alumni contractors")).toBeVisible();
        await expect(modal.getByText("Investors")).not.toBeVisible();
        await expect(modal.getByText("Active contractors")).not.toBeVisible();
      },
      { page, title: "Edit company update" },
    );
  });

  test("prevents submission when no recipients are selected", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company");

    await page.getByRole("button", { name: "New update" }).click();

    await withinModal(
      async (modal) => {
        // Remove all recipients by clicking X buttons
        const investorsBadge = modal.getByRole("button").filter({ hasText: "Investors" }).filter({ hasText: "×" });
        await investorsBadge.locator("svg").click();

        const contractorsBadge = modal
          .getByRole("button")
          .filter({ hasText: "Active contractors" })
          .filter({ hasText: "×" });
        await contractorsBadge.locator("svg").click();

        // Fill in other fields
        await modal.getByLabel("Title").fill("Test");
        await modal.locator('[contenteditable="true"]').fill("Content");

        // Try to publish
        await modal.getByRole("button", { name: "Publish" }).click();

        // Should show validation error
        await expect(modal.locator('[data-slot="form-message"]')).toBeVisible();
      },
      { page, title: "New company update" },
    );

    // Publish dialog should not appear
    await expect(page.getByRole("dialog", { name: "Publish update?" })).not.toBeVisible();
  });
});
