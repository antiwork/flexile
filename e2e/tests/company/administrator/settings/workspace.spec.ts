import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Workspace settings", () => {
  test("allows updating workspace settings", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Workspace settings" }).click();

    await expect(page.getByLabel("Company name")).toHaveValue(company.name ?? "");
    await expect(page.getByLabel("Company website")).toHaveValue(company.website ?? "");
    await expect(page.getByLabel("Brand color")).toHaveValue(company.brandColor ?? "");

    await page.getByLabel("Company name").fill("Updated Company Name");
    await page.getByLabel("Company website").fill("https://example.com");
    await page.getByLabel("Logo").setInputFiles("frontend/images/flexile-logo.svg");
    await page.getByLabel("Brand color").fill("#4b5563");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();

    const updatedCompany = await db.query.companies
      .findFirst({ where: eq(companies.id, company.id) })
      .then(takeOrThrow);

    expect(updatedCompany.publicName).toBe("Updated Company Name");
    expect(updatedCompany.website).toBe("https://example.com");
    expect(updatedCompany.brandColor).toBe("#4b5563");
  });
});
