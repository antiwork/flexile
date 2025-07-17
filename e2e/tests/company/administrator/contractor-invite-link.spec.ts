import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { DocumentTemplateType } from "@/db/enums";
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
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    await page.getByRole("button", { name: "Invite link" }).click();
    await expect(page.getByRole("heading", { name: "Invite Link" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    const inviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(inviteLink).toBeTruthy();

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => Promise.resolve(),
        },
        configurable: true,
      });
    });

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Copied!")).toBeVisible();
  });

  test("shows different invite links for different templates and contract signed elsewhere switch", async ({
    page,
  }) => {
    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.ConsultingContract,
    });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    const defaultInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(defaultInviteLink).toBeTruthy();

    const switchButton = page.getByLabel("Already signed contract elsewhere");
    await expect(switchButton).toHaveAttribute("aria-checked", "true");

    await switchButton.click({ force: true });
    await expect(switchButton).not.toHaveAttribute("aria-checked", "true");

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    const newInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(newInviteLink).not.toBe(defaultInviteLink);

    await switchButton.check({ force: true });
    await expect(switchButton).toHaveAttribute("aria-checked", "true");

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    const checkedInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(checkedInviteLink).toBe(defaultInviteLink);
  });

  test("reset invite link modal resets the link", async ({ page }) => {
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    const originalInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(originalInviteLink).toBeTruthy();

    await page.getByRole("button", { name: "Reset link" }).click();
    await expect(page.getByText("Reset Invite Link")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByText("Reset Invite Link")).not.toBeVisible();
    const newInviteLink = await page.getByRole("textbox", { name: "Link" }).inputValue();
    expect(newInviteLink).not.toBe(originalInviteLink);
  });
});
