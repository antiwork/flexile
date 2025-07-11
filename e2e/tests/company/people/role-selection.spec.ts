import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { fillDatePicker } from "@test/helpers";
import { expect, test } from "@test/index";
import { faker } from "@faker-js/faker";
import { format, addMonths } from "date-fns";

test.describe("Role selection component", () => {
  test("filters existing role suggestions based on typed input", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    await login(page, adminUser);

    // Create contractors with various roles
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Senior Developer",
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Junior Developer",
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Product Designer",
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Project Manager",
    });

    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite contractor" }).click();

    // Test initial state - clicking shows all options
    const roleField = page.getByRole("textbox", { name: "role" });
    await roleField.click();
    await expect(page.getByRole("option", { name: "Project Manager" })).toBeVisible();

    // Test filtering - typing "dev" filters to developer roles
    await roleField.fill("dev");
    await expect(page.getByRole("option", { name: "Senior Developer" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Junior Developer" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Product Designer" })).not.toBeVisible();
    await expect(page.getByRole("option", { name: "Project Manager" })).not.toBeVisible();

    // Test case-insensitive filtering
    await roleField.fill("DESIGN");
    await expect(page.getByRole("option", { name: "Product Designer" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Senior Developer" })).not.toBeVisible();

    // Test selecting a filtered option
    await roleField.fill("senior");
    await page.getByRole("option", { name: "Senior Developer" }).click();
    await expect(roleField).toHaveValue("Senior Developer");
  });

  test("allows entering custom roles not in the suggestion list", async ({ page }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    // Create one existing role
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Frontend Developer",
    });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite contractor" }).click();

    const roleField = page.getByRole("textbox", { name: "role" });

    await roleField.fill("Data Scientist");

    const email = faker.internet.email().toLowerCase();
    await page.getByLabel("Email").fill(email);
    const date = addMonths(new Date(), 1);
    await fillDatePicker(page, "Start date", format(date, "MM/dd/yyyy"));
    await page.getByLabel("Rate").fill("100");
    await page.getByLabel("Already signed contract elsewhere.").check({ force: true });

    await page.getByRole("button", { name: "Send invite" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText("Data Scientist");
  });
});
