import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";

test.describe("Contractor Invite Link", () => {
  test("shows invite link modal and allows copying invite link", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);
    await page.getByRole("link", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    await page.getByRole("button", { name: "Invite link" }).click();
    await expect(page.getByRole("heading", { name: "Invite Link" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Link" })).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async () => Promise.resolve() },
        configurable: true,
      });
    });

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Copied!")).toBeVisible();

    let updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    const link = updatedCompany?.inviteLink;
    expect(link).toBeDefined();
    await expect(page.getByRole("textbox", { name: "Link" })).toHaveValue(
      `${new URL(page.url()).origin}/invite/${link}`,
    );

    await page.getByRole("button", { name: "Reset link" }).click();
    await expect(page.getByText("Reset Invite Link")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByText("Reset Invite Link")).not.toBeVisible();

    updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(updatedCompany?.inviteLink).not.toEqual(link);
  });
});
