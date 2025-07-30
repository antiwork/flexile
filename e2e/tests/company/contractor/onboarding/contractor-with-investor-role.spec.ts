import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, companyAdministrators, users } from "@/db/schema";

test.describe("Contractor with investor role onboarding - personal details", () => {
  let company: typeof companies.$inferSelect;
  let companyAdministrator: typeof companyAdministrators.$inferSelect;
  let onboardingUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    company = (await companiesFactory.create()).company;
    companyAdministrator = (
      await companyAdministratorsFactory.create({
        companyId: company.id,
      })
    ).administrator;

    onboardingUser = (
      await usersFactory.createPreOnboarding({
        countryCode: "US",
        citizenshipCountryCode: "US",
        invitedById: companyAdministrator.userId,
      })
    ).user;

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: onboardingUser.id,
    });
    await companyInvestorsFactory.create({
      companyId: company.id,
      userId: onboardingUser.id,
    });
  });

  test("allows the contractor with investor role to fill in personal details and redirects to invoices", async ({
    page,
  }) => {
    await login(page, onboardingUser);

    await expect(page.getByText("Let's get to know you")).toBeVisible();

    await expect(page.getByLabel("Country of residence")).toHaveText("United States");
    await expect(page.getByLabel("Country of citizenship")).toHaveText("United States");

    await page.getByLabel("Full legal name").fill("");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Full legal name")).not.toBeValid();
    await expect(page.getByText("This doesn't look like a complete full name.")).toBeVisible();

    await page.getByLabel("Full legal name").fill("Wade");
    await page.getByLabel("Preferred name (visible to others)").fill("Wade");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Full legal name")).not.toBeValid();
    await expect(page.getByText("This doesn't look like a complete full name.")).toBeVisible();

    await page.getByLabel("Full legal name").fill("Wade Wilson");
    await page.getByLabel("Preferred name (visible to others)").fill("Wade");
    await selectComboboxOption(page, "Country of citizenship", "Canada");
    await selectComboboxOption(page, "Country of residence", "Canada");

    await page.getByRole("button", { name: "Continue" }).click();

    // For contractor with investor role, should redirect to invoices page (contractor takes precedence)
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, onboardingUser.id),
    });
    expect(updatedUser).toMatchObject({
      citizenshipCountryCode: "CA",
      countryCode: "CA",
      preferredName: "Wade",
      legalName: "Wade Wilson",
    });
  });

  test("shows a notice when a sanctioned country is selected for contractor with investor role", async ({ page }) => {
    await login(page, onboardingUser);

    await page.getByLabel("Full legal name").fill("Wade Wilson");
    await page.getByLabel("Preferred name (visible to others)").fill("Wade");
    await selectComboboxOption(page, "Country of citizenship", "Canada");
    await selectComboboxOption(page, "Country of residence", "Cuba");

    await page.getByRole("button", { name: "Continue" }).click();

    await withinModal(
      async (modal) => {
        await expect(
          modal.getByText(
            "Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform.",
          ),
        ).toBeVisible();
        await expect(
          modal.getByText(
            "You can still use Flexile's features such as sending invoices and receiving equity, but you won't be able to set a payout method or receive any payments.",
          ),
        ).toBeVisible();

        await modal.getByRole("button", { name: "Proceed" }).click();
      },
      { page, title: "Important notice" },
    );

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("Please provide your legal details before creating new invoices.")).toBeVisible();

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, onboardingUser.id),
    });
    expect(updatedUser).toMatchObject({
      citizenshipCountryCode: "CA",
      countryCode: "CU",
      preferredName: "Wade",
      legalName: "Wade Wilson",
    });
  });
});
