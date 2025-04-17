import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companyAdministrators } from "@/db/schema";

test.describe("Board members management", () => {
  test("allows managing board members", async ({ page }) => {
    // Setup two company admins
    const { company } = await companiesFactory.create();
    const { user: admin1 } = await usersFactory.create();
    const { user: admin2 } = await usersFactory.create();

    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin1.id,
    });
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin2.id,
    });

    // Login and navigate to equity settings
    await login(page, admin1);
    await page.goto("/administrator/settings/equity", { waitUntil: "networkidle" });

    // Wait for the main content to be visible
    await page.waitForSelector("main", { state: "visible", timeout: 30000 });

    await page.getByText("Select members...").click();

    // Make admin1 sole board member
    const admin1Name = admin1.legalName || admin1.email;
    const admin2Name = admin2.legalName || admin2.email;
    const admin1Option = page.locator("[cmdk-item]").filter({ hasText: admin1Name });
    await expect(admin1Option).toBeVisible();
    await admin1Option.click();

    // Save and verify
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByText("1 member selected", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const admin1Record = await db.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.userId, admin1.id),
    });
    expect(admin1Record?.boardMember).toBe(true);

    // Make admin2 sole board member
    await page.getByText("1 member selected").click();
    await page.locator("[cmdk-item]").filter({ hasText: admin1Name }).click();
    await page.locator("[cmdk-item]").filter({ hasText: admin2Name }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByText("1 member selected")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    // Verify admin2 is board member and admin1 is not in database
    const [admin1UpdatedRecord, admin2Record] = await Promise.all([
      db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.userId, admin1.id),
      }),
      db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.userId, admin2.id),
      }),
    ]);
    expect(admin1UpdatedRecord?.boardMember).toBe(false);
    expect(admin2Record?.boardMember).toBe(true);

    // Make both board members
    await page.getByText("1 member selected").click();
    await page.locator("[cmdk-item]").filter({ hasText: admin1Name }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByText("2 members selected")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verify both are board members in database
    const [admin1FinalRecord, admin2FinalRecord] = await Promise.all([
      db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.userId, admin1.id),
      }),
      db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.userId, admin2.id),
      }),
    ]);
    expect(admin1FinalRecord?.boardMember).toBe(true);
    expect(admin2FinalRecord?.boardMember).toBe(true);

    // Remove all board members
    await page.getByText("2 members selected").click();
    await page.locator("[cmdk-item]").filter({ hasText: admin1Name }).click();
    await page.locator("[cmdk-item]").filter({ hasText: admin2Name }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByText("Select members...")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verify no board members in database
    const [admin1LastRecord, admin2LastRecord] = await Promise.all([
      db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.userId, admin1.id),
      }),
      db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.userId, admin2.id),
      }),
    ]);
    expect(admin1LastRecord?.boardMember).toBe(false);
    expect(admin2LastRecord?.boardMember).toBe(false);
  });
});
