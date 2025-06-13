import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("Edit contractor", () => {
  test("allows searching for contractors by name", async ({ page }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor: contractor1 } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "SearchTest Role 1",
    });
    const contractor1User = await db.query.users.findFirst({
      where: eq(users.id, contractor1.userId),
    });
    assert(contractor1User != null, "Contractor is required");

    const { companyContractor: contractor2 } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "SearchTest Role 2",
    });
    const contractor2User = await db.query.users.findFirst({
      where: eq(users.id, contractor2.userId),
    });
    assert(contractor2User != null, "Contractor is required");

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();

    const searchInput = page.getByPlaceholder("Search by name...");
    await expect(searchInput).toBeVisible();

    const contractor1FullName = `${contractor1User.legalName || ""} ${contractor1User.preferredName || ""}`.trim();
    await searchInput.fill(contractor1User.preferredName || "");

    await expect(page.getByRole("row").filter({ hasText: contractor1FullName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: contractor2User.preferredName || "" })).not.toBeVisible();
  });
  test("displays concatenated first and last names in people table", async ({ page }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "Test Role",
    });
    const contractor = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractor != null, "Contractor is required");
    assert(contractor.legalName != null, "Contractor legal name is required");
    assert(contractor.preferredName != null, "Contractor preferred name is required");

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();

    const expectedFullName = `${contractor.legalName} ${contractor.preferredName}`;
    await expect(page.getByRole("row").filter({ hasText: expectedFullName })).toBeVisible();

    await expect(page.getByRole("columnheader", { name: "First name" })).not.toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Last name" })).not.toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  });

  test("allows editing details of contractors", async ({ page, sentEmails, next }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });
    const contractor = await db.query.users.findFirst({ where: eq(users.id, companyContractor.userId) });
    assert(contractor != null, "Contractor is required");
    assert(contractor.preferredName != null, "Contractor preferred name is required");
    assert(contractor.legalName != null, "Contractor legal name is required");
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": admin, Signer: contractor }),
    });
    await mockForm(page);

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    const contractorFullName = `${contractor.legalName || ""} ${contractor.preferredName || ""}`.trim();
    await page.getByRole("link", { name: contractorFullName }).click();

    await page.getByRole("heading", { name: contractor.preferredName }).click();
    await expect(page.getByLabel("Role")).toHaveValue(companyContractor.role);
    await expect(page.getByLabel("Legal name")).toHaveValue(contractor.legalName);
    await expect(page.getByLabel("Legal name")).toBeDisabled();

    await page.getByLabel("Role").fill("Stuff-doer");
    await page.getByLabel("Rate").fill("107");
    await page.getByLabel("Average hours").fill("24");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const updatedContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, companyContractor.id),
    });
    assert(updatedContractor !== undefined);
    expect(updatedContractor.role).toBe("Stuff-doer");
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

    const { companyContractor: projectBasedContractor } = await companyContractorsFactory.createProjectBased({
      companyId: company.id,
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
    const projectBasedUserFullName =
      `${projectBasedUser.legalName || ""} ${projectBasedUser.preferredName || ""}`.trim();
    await page.getByRole("link", { name: projectBasedUserFullName }).click();

    await page.getByRole("heading", { name: projectBasedUser.preferredName }).click();
    await expect(page.getByLabel("Role")).toHaveValue(projectBasedContractor.role);

    await page.getByLabel("Role").fill("Stuff-doer");
    await page.getByLabel("Rate").fill("2000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const updatedProjectContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, projectBasedContractor.id),
    });
    assert(updatedProjectContractor !== undefined);
    expect(updatedProjectContractor.role).toBe("Stuff-doer");
    expect(updatedProjectContractor.payRateInSubunits).toBe(200000);
  });
});
