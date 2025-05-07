import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Nullable tax fields after contractor onboarding", () => {
  test("allows contractor to submit tax info with null city, state, street_address, and zip_code fields", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.createWithoutComplianceInfo();
    
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });
    
    await login(page, user);
    
    await page.goto("/settings/tax");
    
    await expect(page.getByText("These details will be included in your invoices and applicable tax forms.")).toBeVisible();
    
    await page.getByLabel("Full legal name (must match your ID)").fill("Test User");
    await page.getByLabel("Tax ID (SSN or ITIN)").fill("123-45-6789");
    
    await page.getByLabel("Residential address (street name, number, apartment)").fill("");
    await page.getByLabel("City").fill("");
    await page.getByLabel("ZIP code").fill("");
    await page.getByLabel("State").selectOption({ label: "Select" });
    
    await page.getByRole("button", { name: "Save changes" }).click();
    
    await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    
    await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).not.toBeVisible();
    
    const updatedUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, user.id),
      with: {
        userComplianceInfos: true,
      },
    });
    
    expect(updatedUser?.userComplianceInfos[0]?.streetAddress).toBe("");
    expect(updatedUser?.userComplianceInfos[0]?.city).toBe("");
    expect(updatedUser?.userComplianceInfos[0]?.state).toBe("");
    expect(updatedUser?.userComplianceInfos[0]?.zipCode).toBe("");
  });
});
