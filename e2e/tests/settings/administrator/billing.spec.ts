import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Company billing settings", () => {
  test("billing settings gated until company name is set", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding(
      { name: "Test Company" },
      { withoutBankAccount: true },
    );

    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({ userId: adminUser.id, companyId: company.id });

    await db.update(companies).set({ name: null }).where(eq(companies.id, company.id));

    await login(page, adminUser, "/settings/administrator/billing");

    await page.reload();

    await expect(page.getByRole("alert")).toBeVisible();
  });
});
