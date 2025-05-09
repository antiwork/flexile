import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { PayRateType } from "@/db/enums";

test.describe("Role autocomplete", () => {
  test("suggests existing roles when inviting a new contractor", async ({ page }: { page: any }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const role1 = "Developer";
    const role2 = "Designer";
    const role3 = "Project Manager";
    
    await companyContractorsFactory.create({ 
      companyId: company.id,
      role: role1,
      payRateType: PayRateType.Hourly
    });
    
    await companyContractorsFactory.create({ 
      companyId: company.id,
      role: role2,
      payRateType: PayRateType.Hourly
    });
    
    await companyContractorsFactory.create({ 
      companyId: company.id,
      role: role3,
      payRateType: PayRateType.Hourly
    });

    await companyContractorsFactory.create({ 
      companyId: company.id,
      role: "Alumni Role",
      endedAt: new Date(),
      payRateType: PayRateType.Hourly
    });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: "Invite contractor" }).click();
    
    const roleField = page.getByLabel("Role");
    
    await roleField.click();
    
    await expect(page.getByText(role1)).toBeVisible();
    await expect(page.getByText(role2)).toBeVisible();
    await expect(page.getByText(role3)).toBeVisible();
    
    await expect(page.getByText("Alumni Role")).not.toBeVisible();
    
    await roleField.fill("dev");
    await expect(page.getByText(role1)).toBeVisible();
    await expect(page.getByText(role2)).not.toBeVisible();
    
    await page.getByText(role1).click();
    await expect(roleField).toHaveValue(role1);
    
    const newRole = "New Custom Role";
    await roleField.fill(newRole);
    await roleField.press("Enter");
    await expect(roleField).toHaveValue(newRole);
  });

  test("suggests existing roles when editing a contractor", async ({ page }: { page: any }) => {
    const { company } = await companiesFactory.create();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const role1 = "Developer";
    const role2 = "Designer";
    const role3 = "Project Manager";
    
    await companyContractorsFactory.create({ 
      companyId: company.id,
      role: role1,
      payRateType: PayRateType.Hourly
    });
    
    await companyContractorsFactory.create({ 
      companyId: company.id,
      role: role2,
      payRateType: PayRateType.Hourly
    });
    
    const { companyContractor } = await companyContractorsFactory.create({ 
      companyId: company.id,
      role: role3,
      payRateType: PayRateType.Hourly
    });
    
    const contractor = await db.query.users.findFirst({ where: eq(users.id, companyContractor.userId) });
    if (!contractor || !contractor.preferredName) {
      throw new Error("Contractor is required");
    }

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractor.preferredName }).click();
    
    const roleField = page.getByLabel("Role");
    
    await expect(roleField).toHaveValue(role3);
    
    await roleField.click();
    
    await expect(page.getByText(role1)).toBeVisible();
    await expect(page.getByText(role2)).toBeVisible();
    await expect(page.getByText(role3)).toBeVisible();
    
    await roleField.fill("des");
    await expect(page.getByText(role2)).toBeVisible();
    await expect(page.getByText(role1)).not.toBeVisible();
    
    await page.getByText(role2).click();
    await expect(roleField).toHaveValue(role2);
    
    const newRole = "New Custom Role";
    await roleField.fill(newRole);
    await roleField.press("Enter");
    await expect(roleField).toHaveValue(newRole);
  });
});
