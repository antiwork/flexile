import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";
import { clerk } from "@clerk/testing/playwright";

test.describe.serial("Workspace settings", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async ({ page }) => {
    clerk.signOut({ page });
    ({ company, adminUser } = await companiesFactory.createCompletedOnboarding());
    await login(page, adminUser);
    await page.goto("/administrator/settings");
    await page.waitForTimeout(1000);
  });

  test("allows updating workspace settings", async ({ page }) => {
    await page.getByLabel("Company name").clear();
    await page.getByLabel("Company name").fill("Updated Company Name");

    await page.getByLabel("Company website").clear();
    await page.getByLabel("Company website").fill("https://example.com");

    const logoPath = "frontend/images/flexile-logo.svg";
    await page.getByLabel("Logo").setInputFiles(logoPath);

    const testColor = "#4B5563";
    await page.locator('input[type="color"]').evaluate((el: HTMLInputElement, color: string) => {
      el.value = color;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, testColor);

    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();

    const updatedCompany = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
    });

    expect(updatedCompany?.publicName).toBe("Updated Company Name");
    expect(updatedCompany?.website).toBe("https://example.com");
    expect(updatedCompany?.brandColor).toBe(testColor.toLowerCase());
  });

  test("displays initial company data in form fields", async ({ page }) => {
    const companyNameInput = page.getByLabel("Company name");
    const websiteInput = page.getByLabel("Company website");

    await expect(companyNameInput).toHaveValue(company.name || "");

    const companyData = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
    });

    await expect(websiteInput).toHaveValue(companyData?.website || "");

    const colorInput = page.locator('input[type="color"]');
    await expect(colorInput).toHaveValue(companyData?.brandColor || "");

    const logoImage = page.locator('img[alt="Company logo"]');
    await expect(logoImage).toBeVisible();
  });
});
