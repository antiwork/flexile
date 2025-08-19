import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { fillOtp, login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import { companyContractors } from "@/db/schema";

test.describe("Contractor Invite Link Joining flow", () => {
  test("invite link flow for unauthenticated user", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({ inviteLink: faker.string.alpha(10) });
    await page.goto(`/invite/${company.inviteLink}`);

    const email = faker.internet.email().toLowerCase();
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Sign up" }).click();
    await fillOtp(page);

    await expect(page).toHaveURL(/documents/iu);
    await expect(page.getByText(/What will you be doing at/iu)).toBeVisible();

    const contractor = await db.query.companyContractors
      .findFirst({ with: { user: true }, where: eq(companyContractors.companyId, company.id) })
      .then(takeOrThrow);

    expect(contractor.user.email).toBe(email);
    expect(contractor.role).toBe(null);
    expect(contractor.contractSignedElsewhere).toBe(true);
  });

  test("invite link flow for authenticated user", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    const { company } = await companiesFactory.createCompletedOnboarding({ inviteLink: faker.string.alpha(10) });

    await login(page, adminUser);

    await page.goto(`/invite/${company.inviteLink}`);
    await expect(page).toHaveURL(/documents/iu);

    await expect(page.getByText(/What will you be doing at/iu)).toBeVisible();
    await expect(page.getByLabel("Role")).toBeVisible();
    await expect(page.getByLabel("Rate")).toBeVisible();

    await page.getByLabel("Role").fill("Hourly Role 1");
    await page.getByLabel("Rate").fill("99");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByText(`Your details have been submitted. ${company.name} will be in touch if anything else is needed.`),
    ).toBeVisible();

    const contractor = await db.query.companyContractors
      .findFirst({
        where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, adminUser.id)),
      })
      .then(takeOrThrow);
    expect(contractor.role).toBe("Hourly Role 1");
    expect(contractor.contractSignedElsewhere).toBe(true);
  });
});
