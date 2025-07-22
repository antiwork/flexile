import { expect, type Page, test } from "@playwright/test";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyUpdatesFactory } from "@test/factories/companyUpdates";
import { login } from "@test/helpers/auth";
import { eq } from "drizzle-orm";
import { companyUpdates } from "@/db/schema";

test.describe("company update creation", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding({
      companyUpdatesEnabled: true,
    });
    company = result.company;
    adminUser = result.adminUser;
  });

  async function fillForm(page: Page, title: string, body: string) {
    await page.getByLabel("Title").fill(title);
    await page.locator('[contenteditable="true"]').fill(body);
  }

  test("allows publishing company update", async ({ page }) => {
    const title = "Published Update";
    const content = "This will be published";

    await login(page, adminUser);
    await page.goto("/updates/company/new");

    await fillForm(page, title, content);
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page.getByRole("dialog", { name: "Publish update?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, publish" }).click();

    await page.waitForURL(/\/updates\/company\/[^/]+$/u);

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(content)).toBeVisible();

    const updates = await db.query.companyUpdates.findMany({
      where: eq(companyUpdates.companyId, company.id),
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sentAt).not.toBeNull();
  });

  test("allows previewing content in new tab", async ({ page, context }) => {
    const title = "Test Update";
    const content = "Test content";

    await login(page, adminUser);
    await page.goto("/updates/company/new");

    await fillForm(page, title, content);

    const newPagePromise = context.waitForEvent("page");
    await page.getByRole("button", { name: "Preview" }).click();

    const newPage = await newPagePromise;
    await newPage.waitForLoadState("networkidle");

    await expect(newPage.getByText(title)).toBeVisible();
    await expect(newPage.getByText(content)).toBeVisible();

    const updates = await db.query.companyUpdates.findMany({
      where: eq(companyUpdates.companyId, company.id),
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sentAt).toBeNull();

    await newPage.close();
  });

  test("prevents submission with validation errors", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company/new");

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.locator('[data-slot="form-message"]').first()).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.locator('[data-slot="form-message"]').first()).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    const updates = await db.query.companyUpdates.findMany({
      where: eq(companyUpdates.companyId, company.id),
    });
    expect(updates).toHaveLength(0);
  });

  test("allows editing published update", async ({ page }) => {
    const { companyUpdate } = await companyUpdatesFactory.createPublished({
      companyId: company.id,
      title: "Original Title",
      body: "<p>Original content</p>",
    });

    await login(page, adminUser);
    await page.goto(`/updates/company/${companyUpdate.externalId}/edit`);

    await page.getByLabel("Title").clear();
    await page.getByLabel("Title").fill("Updated Title");

    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByRole("dialog", { name: "Publish update?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, update" }).click();

    await page.waitForURL(/\/updates\/company\/[^/]+$/u);

    const updatedRecord = await db.query.companyUpdates.findFirst({
      where: eq(companyUpdates.id, companyUpdate.id),
    });
    expect(updatedRecord?.title).toBe("Updated Title");
    expect(updatedRecord?.sentAt).not.toBeNull();
  });
});
