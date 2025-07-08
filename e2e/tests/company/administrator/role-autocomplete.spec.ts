import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, type Page } from "@test/index";

test.describe("Role autocomplete", () => {
  const role1 = "Developer";
  const role2 = "Designer";
  const role3 = "Project Manager";

  const setup = async () => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    await companyContractorsFactory.create({
      companyId: company.id,
      role: role1,
    });

    await companyContractorsFactory.create({
      companyId: company.id,
      role: role2,
    });

    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Alumni Role",
      endedAt: new Date(),
    });

    await companyContractorsFactory.create({
      companyId: company.id,
      role: role3,
    });
    return { company, admin };
  };

  const testAutofill = async (page: Page) => {
    const roleField = page.getByLabel("Role");
    await roleField.click();
    await expect(page.getByRole("option", { name: role1, selected: false })).toBeVisible();
    await expect(page.getByRole("option", { name: role2, selected: false })).toBeVisible();
    await expect(page.getByRole("option", { name: role3, selected: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Alumni Role" })).not.toBeVisible();

    await roleField.fill("dev");
    await expect(page.getByRole("option", { name: role1, selected: true })).toBeVisible();
    await expect(page.getByRole("option", { name: role2, selected: false })).toBeVisible();
    await expect(page.getByRole("option", { name: role3, selected: false })).toBeVisible();
    await roleField.press("Enter");
    await expect(roleField).toHaveValue(role1);

    await page.getByRole("option", { name: role2 }).click();
    await expect(roleField).toHaveValue(role2);
  };

  test("suggests existing roles when inviting a new contractor", async ({ page }) => {
    const { admin } = await setup();
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite contractor" }).click();
    await testAutofill(page);
  });

  test("suggests existing roles when editing a contractor", async ({ page }) => {
    const { company, admin } = await setup();
    const { user } = await usersFactory.create();
    const { companyContractor: contractor } = await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
      role: role3,
    });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: user.preferredName ?? "" }).click();
    await expect(page.getByLabel("Role")).toHaveValue(contractor.role);
    await testAutofill(page);
  });
});
