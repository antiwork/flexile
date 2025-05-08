import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Documents search functionality", () => {
  test("allows administrators to search documents by signer name", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });
    
    await login(page, admin);
    
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    
    const searchInput = page.getByPlaceholder("Search by Signer...");
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill("Test");
  });
});
