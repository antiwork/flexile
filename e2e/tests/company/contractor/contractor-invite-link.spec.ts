import { faker } from "@faker-js/faker";
import type { Page } from "@playwright/test";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { externalProviderMock, fillOtp, login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import { SignInMethod } from "@/db/enums";
import { companyContractors } from "@/db/schema";

const createCompanyWithInviteLink = () =>
  companiesFactory.createCompletedOnboarding({ inviteLink: faker.string.alpha(10) });

const expectOnboardingModal = async (page: Page, isSelfInvite = false) => {
  await expect(page.getByText(/What will you be doing at/iu)).toBeVisible();
  // Modal must not be dismissible - ensures onboarding is completed to prevent modal from reappearing
  // The modal is shown until the worker role is set
  await expect(page.locator('[data-slot="dialog-close"]')).not.toBeVisible();

  if (isSelfInvite) {
    await expect(page).toHaveURL(/self_invite=true/u);
    await expect(page.getByText(/You're inviting yourself!/iu)).toBeVisible();
  } else {
    await expect(page).toHaveURL((url) => !url.toString().includes("self_invite=true"));
    await expect(page.getByText(/You're inviting yourself!/iu)).not.toBeVisible();
  }
};

const expectNoOnboardingModal = (page: Page) => expect(page.getByText(/What will you be doing at/iu)).not.toBeVisible();

const verifyContractorRecord = async (companyId: bigint, userId: bigint, expectedRole: string) => {
  const contractor = await db.query.companyContractors.findFirst({
    where: and(eq(companyContractors.companyId, companyId), eq(companyContractors.userId, userId)),
  });
  expect(contractor).toBeDefined();
  expect(contractor?.role).toBe(expectedRole);
  expect(contractor?.contractSignedElsewhere).toBe(true);
  return contractor;
};

const completeContractorOnboarding = async (page: Page, role: string, rate: string) => {
  await page.getByLabel("Role").fill(role);
  await page.getByLabel("Rate").fill(rate);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Your details have been submitted/iu)).toBeVisible();
};

test.describe("Contractor Invite Link Joining flow", () => {
  test("new user signs up via invite link", async ({ page }) => {
    const { company } = await createCompanyWithInviteLink();
    await page.goto(`/invite/${company.inviteLink}`);

    const email = faker.internet.email().toLowerCase();
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await fillOtp(page);

    await expect(page).toHaveURL(/documents/iu);
    await expectOnboardingModal(page);

    const contractor = await db.query.companyContractors
      .findFirst({ with: { user: true }, where: eq(companyContractors.companyId, company.id) })
      .then(takeOrThrow);

    expect(contractor.user.email).toBe(email);
    expect(contractor.role).toBe(null);
    expect(contractor.contractSignedElsewhere).toBe(true);
  });

  test("user from different company joins as contractor", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    const { company } = await createCompanyWithInviteLink();

    await login(page, adminUser);

    await page.goto(`/invite/${company.inviteLink}`);
    await expect(page).toHaveURL(/documents/iu);

    await expectOnboardingModal(page);
    await expect(page.getByLabel("Role")).toBeVisible();
    await expect(page.getByLabel("Rate")).toBeVisible();

    await completeContractorOnboarding(page, "Hourly Role 1", "99");
    await verifyContractorRecord(company.id, adminUser.id, "Hourly Role 1");
  });

  test("new user signs up via invite link using OAuth", async ({ page }) => {
    const { company } = await createCompanyWithInviteLink();
    await page.goto(`/invite/${company.inviteLink}`);

    const email = faker.internet.email().toLowerCase();
    await externalProviderMock(page, String(SignInMethod.Google), { email });
    await page.getByRole("button", { name: "Sign up with Google" }).click();

    await expect(page).toHaveURL(/documents/iu);
    await expectOnboardingModal(page);

    const contractor = await db.query.companyContractors
      .findFirst({ with: { user: true }, where: eq(companyContractors.companyId, company.id) })
      .then(takeOrThrow);

    expect(contractor.user.email).toBe(email);
    expect(contractor.role).toBe(null);
    expect(contractor.contractSignedElsewhere).toBe(true);
  });

  test("admin joining own company as contractor", async ({ page }) => {
    const { company, adminUser } = await createCompanyWithInviteLink();
    await login(page, adminUser);

    await page.goto(`/invite/${company.inviteLink}`);
    await expect(page).toHaveURL(/documents.*self_invite=true/iu);
    await expectOnboardingModal(page, true);

    await expect(page.getByLabel("Role")).toBeVisible();
    await expect(page.getByLabel("Rate")).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Please enter your role")).toBeVisible();

    await completeContractorOnboarding(page, "Test Admin Role", "100");
    await verifyContractorRecord(company.id, adminUser.id, "Test Admin Role");

    await page.reload();
    await expectNoOnboardingModal(page);
  });
});
