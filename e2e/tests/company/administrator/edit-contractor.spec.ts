import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyRolesFactory } from "@test/factories/companyRoles";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { companyRoles, users } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("Edit contractor", () => {
  test("allows editing details of contractors", async ({ page, sentEmails, next }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { role } = await companyRolesFactory.create({ companyId: company.id });
    const { role: otherRole } = await companyRolesFactory.create({ companyId: company.id });

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      companyRoleId: role.id,
    });
    const contractor = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractor != null, "Contractor is required");
    assert(contractor.preferredName != null, "Contractor preferred name is required");
    assert(contractor.legalName != null, "Contractor legal name is required");
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": admin, Signer: contractor }),
    });
    await mockForm(page);

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractor.preferredName }).click();

    await page.getByRole("heading", { name: contractor.preferredName }).click();
    await expect(page.getByLabel("Role")).toContainText(role.name);
    await expect(page.getByLabel("Legal name")).toHaveValue(contractor.legalName);
    await expect(page.getByLabel("Legal name")).toBeDisabled();

    await selectComboboxOption(page, "Role", otherRole.name);
    await page.getByLabel("Rate").fill("107");
    await page.getByLabel("Average hours").fill("24");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const updatedContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, companyContractor.id),
    });
    assert(updatedContractor !== undefined);
    expect(updatedContractor.companyRoleId).toBe(otherRole.id);
    expect(updatedContractor.hoursPerWeek).toBe(24);
    expect(updatedContractor.payRateInSubunits).toBe(10700);

    expect(sentEmails).toEqual([
      expect.objectContaining({
        to: contractor.email,
        subject: "Your rate has changed!",
        text: expect.stringContaining(
          `Your rate has changed!Old rate$${companyContractor.payRateInSubunits / 100}/hrNew rate$107/hr`,
        ),
      }),
    ]);
  });

  test("allows editing project-based contractor details", async ({ page, next }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { role: projectBasedRole } = await companyRolesFactory.createProjectBased({ companyId: company.id });
    const { role: otherProjectBasedRole } = await companyRolesFactory.createProjectBased({
      companyId: company.id,
      name: "Videographer",
    });

    const { companyContractor: projectBasedContractor } = await companyContractorsFactory.createProjectBased({
      companyId: company.id,
      companyRoleId: projectBasedRole.id,
    });
    const projectBasedUser = await db.query.users.findFirst({
      where: eq(users.id, projectBasedContractor.userId),
    });
    assert(projectBasedUser !== undefined);
    assert(projectBasedUser.preferredName !== null);
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": admin, Signer: projectBasedUser }),
    });
    await mockForm(page);

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: projectBasedUser.preferredName }).click();

    await page.getByRole("heading", { name: projectBasedUser.preferredName }).click();
    await expect(page.getByLabel("Role")).toContainText(projectBasedRole.name);

    await selectComboboxOption(page, "Role", otherProjectBasedRole.name);
    await page.getByLabel("Rate").fill("2000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const updatedProjectContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, projectBasedContractor.id),
    });
    assert(updatedProjectContractor !== undefined);
    expect(updatedProjectContractor.companyRoleId).toBe(otherProjectBasedRole.id);
    expect(updatedProjectContractor.payRateInSubunits).toBe(200000);
  });

  test("allows creating a new role ad-hoc", async ({ page, sentEmails, next }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
    });
    const contractor = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractor !== undefined);
    assert(contractor.preferredName !== null);
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": admin, Signer: contractor }),
    });
    await mockForm(page);

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractor.preferredName }).click();

    await page.getByRole("button", { name: "Create new" }).click();

    await page.getByLabel("Name", { exact: true }).fill("Example Role");
    await page.getByLabel("New role").getByLabel("Rate", { exact: true }).fill("200");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await selectComboboxOption(page, "Role", "Example Role");
    await expect(page.getByLabel("RoleCreate New")).toContainText("Example Role");
    await expect(page.getByLabel("Rate")).toHaveValue("200");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const newRole = await db.query.companyRoles.findFirst({
      orderBy: desc(companyRoles.id),
      where: eq(companyRoles.companyId, company.id),
    });
    assert(newRole !== undefined);
    expect(newRole.name).toBe("Example Role");
    expect(newRole.activelyHiring).toBe(false);

    const updatedContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, companyContractor.id),
    });
    assert(updatedContractor !== undefined);
    expect(updatedContractor.companyRoleId).toBe(newRole.id);
    expect(updatedContractor.payRateInSubunits).toBe(20000);

    expect(sentEmails).toEqual([
      expect.objectContaining({
        to: contractor.email,
        subject: "Your rate has changed!",
        text: expect.stringContaining(
          `Your rate has changed!Old rate$${companyContractor.payRateInSubunits / 100}/hrNew rate$200/hr`,
        ),
      }),
    ]);
  });
});
