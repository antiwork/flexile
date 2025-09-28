import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import { companyContractors, companyInvestors, companyLawyers } from "@/db/schema";

const waitForLeaveSuccess = async (page: Page) => {
  await page.waitForTimeout(5000);
  return true;
};

const getTimeout = () => (process.env.CI === "true" ? 300000 : 30000);

test.describe.serial("Leave company", () => {
  test("administrator cannot see leave workspace option", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.getByRole("link", { name: "Settings" }).click();

    await expect(page.getByText("Leave workspace")).not.toBeVisible();
  });

  test("contractor can leave successfully", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    await login(page, user);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Leave workspace" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Leave this workspace?")).toBeVisible({ timeout: getTimeout() });

    const leaveButton = page.getByRole("button", { name: "Leave" });
    const successPromise = waitForLeaveSuccess(page);

    await leaveButton.click();
    await successPromise;
    await page.waitForLoadState("networkidle");

    const contractor = await db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, user.id)),
    });
    expect(contractor?.endedAt).toBeTruthy();
  });

  test("lawyer can leave successfully", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();

    await companyLawyersFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    await login(page, user);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Leave workspace" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Leave this workspace?")).toBeVisible({ timeout: getTimeout() });

    const leaveButton = page.getByRole("button", { name: "Leave" });
    const successPromise = waitForLeaveSuccess(page);

    await leaveButton.click();
    await successPromise;
    await page.waitForLoadState("networkidle");

    const lawyer = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, company.id), eq(companyLawyers.userId, user.id)),
    });
    expect(lawyer).toBeUndefined();
  });

  test("user with multiple roles can leave successfully", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    await companyLawyersFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    await login(page, user);
    await page.getByRole("link", { name: "Settings" }).click();

    await page.getByRole("button", { name: "Leave workspace" }).click();

    await expect(page.getByText("Leave this workspace?")).toBeVisible();

    const leaveButton = page.getByRole("button", { name: "Leave" });
    const successPromise = waitForLeaveSuccess(page);

    await leaveButton.click();
    await successPromise;

    const contractor = await db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, user.id)),
    });
    const lawyer = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, company.id), eq(companyLawyers.userId, user.id)),
    });
    const investor = await db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, user.id)),
    });

    expect(contractor?.endedAt).toBeTruthy();
    expect(lawyer).toBeUndefined();
    expect(investor).toBeDefined(); // We don't delete the `company_investors` data as it referenced in other tables
  });

  test("user can cancel leaving workspace", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();

    await companyLawyersFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    await login(page, user);
    await page.getByRole("link", { name: "Settings" }).click();

    await page.getByRole("button", { name: "Leave workspace" }).click();

    const dialog = page.getByText("Leave this workspace?");
    await expect(dialog).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible({ timeout: getTimeout() });

    const lawyer = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, company.id), eq(companyLawyers.userId, user.id)),
    });
    expect(lawyer).toBeDefined();
  });

  test("user with roles in other companies can leave current company successfully", async ({ page }) => {
    const { company: companyA } = await companiesFactory.createCompletedOnboarding({ name: "Company A" });
    const { company: companyB } = await companiesFactory.createCompletedOnboarding({ name: "Company B" });
    const { user } = await usersFactory.create();

    await companyLawyersFactory.create({
      companyId: companyA.id,
      userId: user.id,
    });
    await companyLawyersFactory.create({
      companyId: companyB.id,
      userId: user.id,
    });

    await login(page, user);

    await expect(page.getByRole("button", { name: "Company A" })).toBeVisible();
    await page.getByRole("link", { name: "Settings" }).click();

    await page.getByRole("button", { name: "Leave workspace" }).click();

    // Wait for dialog to appear
    await expect(page.getByText("Leave this workspace?")).toBeVisible();

    // Click leave button and wait for success (should redirect to dashboard for multi-company user)
    const leaveButton = page.getByRole("button", { name: "Leave" });
    const successPromise = waitForLeaveSuccess(page);

    await leaveButton.click();
    await successPromise;

    // Wait for the company switch to complete
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Company B" })).toBeVisible({ timeout: getTimeout() });

    const lawyerA = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, companyA.id), eq(companyLawyers.userId, user.id)),
    });
    const lawyerB = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, companyB.id), eq(companyLawyers.userId, user.id)),
    });

    expect(lawyerA).toBeUndefined();
    expect(lawyerB).toBeDefined();
  });
});
