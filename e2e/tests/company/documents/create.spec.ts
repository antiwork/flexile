import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login, logout } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("Document Creation", () => {
  let contractor1User: typeof users.$inferSelect | undefined;
  let contractor2User: typeof users.$inferSelect | undefined;

  test.beforeEach(async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor: contractor1 } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "Test Contractor",
    });
    contractor1User = await db.query.users.findFirst({
      where: eq(users.id, contractor1.userId),
    });

    const { companyContractor: contractor2 } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "Other Contractor",
    });
    contractor2User = await db.query.users.findFirst({
      where: eq(users.id, contractor2.userId),
    });
    assert(contractor2User !== undefined);

    await login(page, admin);
    await page.goto("/documents");
  });

  test("NewDocument button visible to admin", async ({ page }) => {
    await expect(page.getByRole("button", { name: "New document" })).toBeVisible();
    await page.getByRole("button", { name: "New document" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Choose how you'd like to add your document")).toBeVisible();
  });

  test("NewDocument button not visible to contractor", async ({ page }) => {
    await logout(page);
    assert(contractor1User !== undefined);
    await login(page, contractor1User);
    await page.goto("/documents");
    await expect(page.getByRole("button", { name: "New document" })).not.toBeVisible();
  });

  test("switches between Upload and Write tabs", async ({ page }) => {
    await page.getByRole("button", { name: "New document" }).click();
    const uploadTab = page.getByRole("tab", { name: "Upload" });
    const writeTab = page.getByRole("tab", { name: "Write" });

    await expect(uploadTab).toBeVisible();
    await expect(writeTab).toBeVisible();

    await writeTab.click();
    await expect(page.locator('input[type="text"][name="document-title"]')).toBeVisible();

    await uploadTab.click();
    await expect(page.getByText("Drag and drop or click to browse your file here")).toBeVisible();
  });

  test("uploads a file and submits", async ({ page }) => {
    await page.getByRole("button", { name: "New document" }).click();
    await page.getByRole("tab", { name: "Upload" }).click();
    await page.locator('input[type="file"][id="contract-upload"]').setInputFiles({
      name: "sample-contract.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("test document content"),
    });
    await expect(page.getByText("sample-contract.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Agreement")).toBeVisible();
  });

  test("writes document content and submits", async ({ page }) => {
    await page.getByRole("button", { name: "New document" }).click();

    await page.getByRole("tab", { name: "Write" }).click();
    await page.locator('input[type="text"][name="document-title"]').fill("Test Agreement");
    await page.locator('[contenteditable="true"]').fill("Test Agreement");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText("Test Agreement")).toBeVisible();
  });

  test("shows validation errors if required fields missing", async ({ page }) => {
    await page.getByRole("button", { name: "New document" }).click();
    await page.getByRole("tab", { name: "Write" }).click();
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(/Invalid parameters/iu)).toBeVisible();
  });

  test("shows error message on API failure", async ({ page }) => {
    await page.getByRole("button", { name: "New document" }).click();
    await page.getByRole("tab", { name: "Write" }).click();
    await page.locator('input[type="text"][name="document-title"]').fill("Test Agreement");
    await page.locator('[contenteditable="true"]').fill("Test Agreement");

    await page.route("**/internal/companies/**/documents", (route) =>
      route.fulfill({ status: 422, body: JSON.stringify({ error_message: "Invalid parameters" }) }),
    );
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Invalid parameters")).toBeVisible();
  });
});
