import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { companies, users } from "@/db/schema";

test.describe("Contractor Invite Link", () => {
  let company: typeof companies.$inferSelect;
  let admin: typeof users.$inferSelect;

  test.beforeEach(async () => {
    const result = await companiesFactory.create();
    company = result.company;
    const adminResult = await usersFactory.create();
    admin = adminResult.user;
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });
  });

  test("shows invite link modal and allows copying invite link", async ({ page }) => {
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();
    await expect(page.getByRole("heading", { name: "Invite Link" })).toBeVisible();

    await page.waitForTimeout(100);
    const inviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(inviteLink).toBeTruthy();

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {},
        },
        configurable: true,
      });
    });

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  });

  test("shows different invite links for different templates and contract signed elsewhere switch", async ({
    page,
  }) => {
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();

    const defaultInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(defaultInviteLink).toBeTruthy();

    const switchButton = page.getByRole("switch", { name: "Already signed contract elsewhere" });
    await expect(switchButton).toBeChecked();

    await switchButton.click({ force: true });
    await page.waitForTimeout(300);

    const newInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(newInviteLink).not.toBe(defaultInviteLink);

    await switchButton.click({ force: true });
    await page.waitForTimeout(300);
    await expect(switchButton).toBeChecked();

    const checkedInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(checkedInviteLink).toBe(defaultInviteLink);
  });

  test("reset invite link modal resets the link", async ({ page }) => {
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();

    const originalInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(originalInviteLink).toBeTruthy();

    await page.getByRole("button", { name: "Reset link" }).click();
    await expect(page.getByText("Reset Invite Link")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await expect(page.getByText("Reset Invite Link")).not.toBeVisible();
    const newInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(newInviteLink).not.toBe(originalInviteLink);
  });
});
