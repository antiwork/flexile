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
    await page.getByRole("link", { name: contractor.preferredName }).click();

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
    await page.getByRole("link", { name: projectBasedUser.preferredName }).click();

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
