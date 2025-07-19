import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { companies, companyInviteLinks, users } from "@/db/schema";

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
    await expect(page.getByRole("textbox", { name: "Link" })).toBeVisible();

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

    const defaultInviteLink = await db.query.companyInviteLinks.findFirst({
      where: and(eq(companyInviteLinks.companyId, company.id), isNull(companyInviteLinks.documentTemplateId)),
    });
    expect(defaultInviteLink).toBeDefined();
  });

  test("shows different invite links for different templates and contract signed elsewhere switch", async ({
    page,
  }) => {
    await documentTemplatesFactory.create({
      companyId: company.id,
      name: "Default Contract",
      type: DocumentTemplateType.ConsultingContract,
    });

    await documentTemplatesFactory.create({
      companyId: company.id,
      name: "Another Contract",
      type: DocumentTemplateType.ConsultingContract,
    });

    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Link" })).toBeVisible();

    const switchButton = page.getByLabel("Already signed contract elsewhere");
    await expect(switchButton).toHaveAttribute("aria-checked", "true");

    await switchButton.click({ force: true });
    await expect(switchButton).not.toHaveAttribute("aria-checked", "true");

    await page.getByRole("combobox").click();
    await expect(page.getByRole("option", { name: "Default Contract" })).toBeVisible();
    await page.getByRole("option", { name: "Default Contract" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();

    const defaultInviteLink = await db.query.companyInviteLinks.findFirst({
      where: and(eq(companyInviteLinks.companyId, company.id), isNull(companyInviteLinks.documentTemplateId)),
    });
    expect(defaultInviteLink).toBeDefined();

    const newInviteLink = await db.query.companyInviteLinks.findFirst({
      where: and(eq(companyInviteLinks.companyId, company.id), isNotNull(companyInviteLinks.documentTemplateId)),
    });
    expect(newInviteLink).toBeDefined();

    expect(newInviteLink?.token).not.toBe(defaultInviteLink?.token);
  });

  test("reset invite link modal resets the link", async ({ page }) => {
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite link" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Link" })).toBeVisible();

    await page.getByRole("button", { name: "Reset link" }).click();
    await expect(page.getByText("Reset Invite Link")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByText("Reset Invite Link")).not.toBeVisible();
    const newInviteLink = await db.query.companyInviteLinks.findFirst({
      where: and(eq(companyInviteLinks.companyId, company.id), isNull(companyInviteLinks.documentTemplateId)),
    });
    expect(newInviteLink).toBeDefined();
  });
});
