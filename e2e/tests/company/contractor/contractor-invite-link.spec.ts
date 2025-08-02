import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login, logout } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq } from "drizzle-orm";
import { companies, companyContractors, companyInviteLinks, users } from "@/db/schema";

test.describe("Contractor Invite Link Joining flow", () => {
  let company: typeof companies.$inferSelect;
  let admin: typeof users.$inferSelect;
  let inviteLink: typeof companyInviteLinks.$inferSelect | undefined;

  test.beforeEach(async () => {
    const result = await companiesFactory.create({
      name: "Gumroad",
      streetAddress: "548 Market Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94104-5401",
      countryCode: "US",
    });
    company = result.company;

    const adminResult = await usersFactory.create();
    admin = adminResult.user;

    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    await db.insert(companyInviteLinks).values({
      companyId: company.id,
      documentTemplateId: null,
      token: encodeURIComponent(crypto.randomUUID()),
      createdAt: new Date(),
    });

    inviteLink = await db.query.companyInviteLinks.findFirst({
      where: eq(companyInviteLinks.companyId, company.id),
    });
  });

  test("invite link flow for unauthenticated user", async ({ page, context }) => {
    await page.goto(`/invite/${inviteLink?.token}`);
    await expect(page).toHaveURL(/signup/iu);

    const cookies = await context.cookies();
    const invitationCookie = cookies.find((c) => c.name === "invitation_token");
    expect(inviteLink?.token).toContain(invitationCookie?.value);
  });

  test("invite link flow for authenticated user", async ({ page }) => {
    const { user: contractor } = await usersFactory.create();
    const result = await companiesFactory.create();
    const existingCompany = result.company;
    await companyAdministratorsFactory.create({
      companyId: existingCompany.id,
      userId: contractor.id,
    });

    await login(page, contractor);

    await page.goto(`/invite/${inviteLink?.token}`);
    await expect(page).toHaveURL(/documents/iu);

    const createdCompayContractor = await db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, contractor.id)),
    });

    expect(createdCompayContractor).toBeDefined();
    expect(createdCompayContractor?.role).toBe(null);
    expect(createdCompayContractor?.contractSignedElsewhere).toBe(true);

    await expect(page.getByText(/What will you be doing at/iu)).toBeVisible();
    await expect(page.getByLabel("Role")).toBeVisible();
    await expect(page.getByLabel("Rate")).toBeVisible();

    await page.getByLabel("Role").fill("Hourly Role 1");
    await page.getByLabel("Rate").fill("99");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByText(`Your details have been submitted. ${company.name} will be in touch if anything else is needed.`),
    ).toBeVisible();
    await page.locator('div[role="dialog"] button:has-text("Close")').first().click();

    await page.getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const updatedCompayContractor = await db.query.companyContractors.findFirst({
      where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, contractor.id)),
    });
    expect(updatedCompayContractor?.role).not.toBe(null);

    await logout(page);
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: contractor.preferredName || contractor.email });
    await expect(row).toContainText(contractor.preferredName || contractor.email);
    await expect(row).toContainText("Hourly Role 1");
  });
});
