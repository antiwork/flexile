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

const waitForLeaveApiResponse = async (page: Page, maxRetries = 15) => {
  const startTime = Date.now();
  console.log(`Starting API wait (max ${maxRetries} retries) in ${process.env.CI ? "CI" : "Local"} environment`);
  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();
    try {
      console.log(`Attempt ${i + 1}/${maxRetries} - waiting for API response...`);
      const response = await page.waitForResponse(
        (response) =>
          response.url().includes("/internal/companies/") &&
          response.url().includes("/leave") &&
          response.status() === 200,
        { timeout: process.env.CI === "true" ? 90000 : 30000 },
      );
      const totalTime = Date.now() - startTime;
      console.log(`API response received in ${totalTime}ms (attempt ${i + 1})`);
      return response;
    } catch (error) {
      const attemptTime = Date.now() - attemptStart;
      const totalTime = Date.now() - startTime;
      console.log(`Attempt ${i + 1} failed after ${attemptTime}ms (total: ${totalTime}ms)`);
      if (i === maxRetries - 1) {
        console.log(`All ${maxRetries} attempts failed after ${totalTime}ms`);
        if (process.env.CI === "true") {
          await page.screenshot({ path: `ci_failure_${Date.now()}.png` });
        }
        throw error;
      }
      console.log(`Retrying in 5s... (${maxRetries - i - 1} attempts left)`);
      await page.waitForTimeout(5000);
    }
  }
};

const getTimeout = () => {
  const timeout = process.env.CI === "true" ? 120000 : 15000;
  console.log(`Using timeout: ${timeout}ms (${process.env.CI ? "CI" : "Local"})`);
  return timeout;
};

test.describe.serial("Leave company", () => {
  test("administrator cannot see leave workspace option", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.getByRole("link", { name: "Settings" }).click();

    await expect(page.getByText("Leave workspace")).not.toBeVisible();
  });

  test("contractor can leave successfully", async ({ page }) => {
    console.log("Starting contractor leave test");
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
    const responsePromise = waitForLeaveApiResponse(page);

    await leaveButton.click();
    await responsePromise;

    await page.waitForURL("/login", { timeout: getTimeout() });
    await page.waitForLoadState("networkidle");

    const contractor = await db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, user.id)),
    });
    expect(contractor?.endedAt).toBeTruthy();
    console.log("Contractor leave test completed");
  });

  test("lawyer can leave successfully", async ({ page }) => {
    console.log("Starting lawyer leave test");
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
    const responsePromise = waitForLeaveApiResponse(page);

    await leaveButton.click();
    await responsePromise;

    await page.waitForURL("/login", { timeout: getTimeout() });
    await page.waitForLoadState("networkidle");

    const lawyer = await db.query.companyLawyers.findFirst({
      where: and(eq(companyLawyers.companyId, company.id), eq(companyLawyers.userId, user.id)),
    });
    expect(lawyer).toBeUndefined();
    console.log("Lawyer leave test completed");
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
    const responsePromise = waitForLeaveApiResponse(page);

    await leaveButton.click();
    await responsePromise;

    await page.waitForURL("/login", { timeout: getTimeout() });

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

    // Click leave button and wait for API response
    const leaveButton = page.getByRole("button", { name: "Leave" });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/internal/companies/") &&
        response.url().includes("/leave") &&
        response.status() === 200,
    );

    await leaveButton.click();
    await responsePromise;

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
