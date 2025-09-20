import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { optionPools, shareClasses } from "@/db/schema";

test.describe("Option Pools", () => {
  test("admin can create an option pool and list updates", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({ equityEnabled: true });
    await shareClassesFactory.create({
      companyId: company.id,
      name: "Common",
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Option pools" }).click();

    await page.getByRole("button", { name: "New option pool" }).click();
    await expect(page.getByRole("dialog", { name: "New option pool" })).toBeVisible();

    await page.getByLabel("Pool name").fill("2025 Equity plan");
    await selectComboboxOption(page, "Share class", "Common");
    await page.getByLabel("Authorized shares").fill("1000000");

    await page.getByRole("button", { name: "Create option pool" }).click();

    await expect(page.getByRole("dialog", { name: "New option pool" })).not.toBeVisible();
    await expect(page.getByRole("table").first()).toContainText("2025 Equity plan");
    await expect(page.getByRole("table").first()).toContainText("1,000,000");

    const created = await db.query.optionPools.findFirst({
      where: eq(optionPools.companyId, company.id),
      orderBy: (optionPools, { desc }) => [desc(optionPools.id)],
    });
    expect(created?.name).toBe("2025 Equity plan");
    expect(created?.authorizedShares).toBe(1000000n);
    expect(created?.issuedShares).toBe(0n);
    expect(created?.availableShares).toBe(1000000n);

    if (!created) throw new Error("Option pool not created");
    const sc = await db.query.shareClasses.findFirst({
      where: eq(shareClasses.id, created.shareClassId),
    });
    expect(sc?.companyId).toBe(company.id);
  });

  test("lawyer cannot see creation button", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });
    await optionPoolsFactory.create({ companyId: company.id });
    const { user: lawyerUser } = await usersFactory.create();
    await companyLawyersFactory.create({
      companyId: company.id,
      userId: lawyerUser.id,
    });

    await login(page, lawyerUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Option pools" }).click();
    await expect(page.getByRole("heading", { name: "Option pools" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New option pool" })).not.toBeVisible();
  });

  test("admin can customize exercise periods and they persist", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({ equityEnabled: true });
    await shareClassesFactory.create({ companyId: company.id, name: "Common" });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Option pools" }).click();

    await page.getByRole("button", { name: "New option pool" }).click();
    await page.getByLabel("Pool name").fill("Plan with custom exercise windows");
    await selectComboboxOption(page, "Share class", "Common");
    await page.getByLabel("Authorized shares").fill("500000");

    await page.getByRole("button", { name: "Customize post-termination exercise periods" }).click();

    await page.getByLabel("Expiration period").fill("84");
    await page.getByLabel("Voluntary termination", { exact: true }).fill("6");
    await page.getByLabel("Involuntary termination", { exact: true }).fill("6");
    await page.getByLabel("Termination with cause").fill("0");
    await page.getByLabel("Death", { exact: true }).fill("24");
    await page.getByLabel("Disability").fill("24");
    await page.getByLabel("Retirement").fill("24");

    await page.getByRole("button", { name: "Create option pool" }).click();

    await expect(page.getByRole("dialog", { name: "New option pool" })).not.toBeVisible();

    const created = await db.query.optionPools.findFirst({
      where: eq(optionPools.companyId, company.id),
      orderBy: (optionPools, { desc }) => [desc(optionPools.id)],
    });
    expect(created?.name).toBe("Plan with custom exercise windows");
    expect(created?.defaultOptionExpiryMonths).toBe(84);
    expect(created?.voluntaryTerminationExerciseMonths).toBe(6);
    expect(created?.involuntaryTerminationExerciseMonths).toBe(6);
    expect(created?.terminationWithCauseExerciseMonths).toBe(0);
    expect(created?.deathExerciseMonths).toBe(24);
    expect(created?.disabilityExerciseMonths).toBe(24);
    expect(created?.retirementExerciseMonths).toBe(24);
  });

  test("defaults are applied when exercise periods not customized", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({ equityEnabled: true });
    await shareClassesFactory.create({ companyId: company.id, name: "Common" });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Option pools" }).click();

    await page.getByRole("button", { name: "New option pool" }).click();
    await page.getByLabel("Pool name").fill("Plan with defaults");
    await selectComboboxOption(page, "Share class", "Common");
    await page.getByLabel("Authorized shares").fill("250000");
    await page.getByRole("button", { name: "Create option pool" }).click();

    await expect(page.getByRole("dialog", { name: "New option pool" })).not.toBeVisible();

    const created = await db.query.optionPools.findFirst({
      where: eq(optionPools.companyId, company.id),
      orderBy: (optionPools, { desc }) => [desc(optionPools.id)],
    });
    expect(created?.defaultOptionExpiryMonths).toBe(120);
    expect(created?.voluntaryTerminationExerciseMonths).toBe(120);
    expect(created?.involuntaryTerminationExerciseMonths).toBe(120);
    expect(created?.terminationWithCauseExerciseMonths).toBe(0);
    expect(created?.deathExerciseMonths).toBe(120);
    expect(created?.disabilityExerciseMonths).toBe(120);
    expect(created?.retirementExerciseMonths).toBe(120);
  });
});
