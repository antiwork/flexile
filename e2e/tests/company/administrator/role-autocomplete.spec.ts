import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";
import { assertDefined } from "@/utils/assert";

test.describe("Role autocomplete", () => {
  const role1 = "Designer";
  const role2 = "Developer";
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
    await expect(page.getByRole("option", { name: role1 })).not.toBeVisible();
    await expect(page.getByRole("option", { name: role2 })).not.toBeVisible();
    await expect(page.getByRole("option", { name: role3 })).toBeVisible();
    await expect(page.getByRole("option", { name: "Alumni Role" })).not.toBeVisible();

    await roleField.clear();
    await expect(page.getByRole("option", { name: role1 })).toBeVisible();
    await expect(page.getByRole("option", { name: role2 })).toBeVisible();
    await expect(page.getByRole("option", { name: role3 })).toBeVisible();
    await expect(page.getByRole("option", { name: "Alumni Role" })).not.toBeVisible();

    await roleField.fill("de");

    // Wait explicitly for the desired option to appear, then click it.
    const option1 = page.getByRole("option", { name: role1 });
    await option1.waitFor({ state: "visible", timeout: 5000 });
    await expect(option1).toBeVisible();

    await expect(page.getByRole("option", { name: role2 })).toBeVisible();
    await expect(page.getByRole("option", { name: role3 })).not.toBeVisible();

    // Click the visible option instead of pressing Enter to avoid flaky key handling.
    await option1.click();

    // Verify the input now contains the selected role and the dropdown is closed.
    await expect(roleField).toHaveValue(role1);
    await expect(page.getByRole("option")).not.toBeVisible();
  };

  test("suggests existing roles when inviting a new contractor", async ({ page }) => {
    const { admin } = await setup();
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Add contractor" }).click();
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
    await expect(page.getByLabel("Role")).toHaveValue(assertDefined(contractor.role));
    await testAutofill(page);
  });
});
