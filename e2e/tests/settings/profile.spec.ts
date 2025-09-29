import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Profile settings", () => {
  test("user can update email and preferred name", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.getByRole("link", { name: "Settings" }).click();

    const emailInput = page.getByLabel("Email");
    await emailInput.clear();
    await emailInput.fill("updated.email@example.com");

    const nameInput = page.getByLabel("Preferred name (visible to others)");
    await nameInput.clear();
    await nameInput.fill("Updated Name");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved!")).toBeVisible();

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, adminUser.id),
    });

    expect(updatedUser?.email).toBe("updated.email@example.com");
    expect(updatedUser?.preferredName).toBe("Updated Name");

    await page.reload();
    await expect(emailInput).toHaveValue("updated.email@example.com");
    await expect(nameInput).toHaveValue("Updated Name");
  });

  test("user can clear preferred name", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    await page.getByRole("link", { name: "Settings" }).click();

    const nameInput = page.getByLabel("Preferred name (visible to others)");
    await nameInput.fill("Temporary Name");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved!")).toBeVisible();

    await nameInput.clear();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved!")).toBeVisible();

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, adminUser.id),
    });

    expect(updatedUser?.preferredName).toBe("");

    await page.reload();
    await expect(nameInput).toHaveValue("");
  });
});
