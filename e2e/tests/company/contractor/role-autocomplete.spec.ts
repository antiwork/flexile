import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { fillOtp } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Contractor onboarding role autocomplete", () => {
  test("shows default roles and allows filtering during contractor onboarding", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({ inviteLink: "test-invite-link" });
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    // Go to invite link and sign up
    await page.goto(`/invite/${company.inviteLink}`);

    const email = "contractor+role-test@example.com";
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await fillOtp(page);

    // Should be on the onboarding page
    await expect(page.getByText(/What will you be doing at/iu)).toBeVisible();

    const roleField = page.getByLabel("Role");
    await roleField.click();

    // Should show all default roles
    await expect(page.getByRole("option", { name: "Software Engineer" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Designer" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Product Manager" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Data Analyst" })).toBeVisible();

    // Test filtering by typing "de"
    await roleField.fill("de");
    await expect(page.getByRole("option", { name: "Software Engineer" })).not.toBeVisible();
    await expect(page.getByRole("option", { name: "Designer" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Product Manager" })).not.toBeVisible();
    await expect(page.getByRole("option", { name: "Data Analyst" })).not.toBeVisible();

    // Select Designer
    // make sure visible and then selec
    await expect(page.getByRole("option", { name: "Designer" })).toBeVisible();
    await page.getByRole("option", { name: "Designer" }).click();
    await expect(roleField).toHaveValue("Designer");
    await expect(page.getByRole("option")).not.toBeVisible();
  });
});
