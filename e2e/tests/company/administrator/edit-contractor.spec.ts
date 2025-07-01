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
import { PayRateType } from "@/db/enums";

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

    await searchInput.fill(contractor1User.preferredName || "");

    await expect(page.getByRole("row").filter({ hasText: contractor1User.preferredName || "" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: contractor2User.preferredName || "" })).not.toBeVisible();
  });
  test("allows editing details of contractors", async ({ page, next }) => {
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
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const updatedContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, companyContractor.id),
    });
    assert(updatedContractor !== undefined);
    expect(updatedContractor.role).toBe("Stuff-doer");
    expect(updatedContractor.payRateInSubunits).toBe(10700);
  });

  test("allows editing details of contractors with a custom rate", async ({ page, next }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });
    const user = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(user !== undefined);
    assert(user.preferredName !== null);
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": admin, Signer: user }),
    });
    await mockForm(page);

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: user.preferredName }).click();
    await page.getByRole("heading", { name: user.preferredName }).click();

    await page.getByLabel("Role").fill("Stuff-doer");
    await page.getByRole("radio", { name: "Custom" }).click({ force: true });
    await page.getByLabel("Rate").fill("2000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Sign now" })).toBeVisible();

    const updatedContractor = await db.query.companyContractors.findFirst({
      where: eq(users.id, companyContractor.id),
    });
    assert(updatedContractor !== undefined);
    expect(updatedContractor.payRateType).toBe(PayRateType.Custom);
    expect(updatedContractor.role).toBe("Stuff-doer");
    expect(updatedContractor.payRateInSubunits).toBe(200000);
  });
});
