import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker, findRichTextEditor } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { assertDefined } from "@/utils/assert";

test.describe("Contractor for multiple companies", () => {
  test("contractor accepts invitation from second company and signs contract", async ({ page }) => {
    const { user: contractorUser } = await usersFactory.create({
      preferredName: "Alex",
      invitationCreatedAt: new Date("2023-01-01"),
      invitationSentAt: new Date("2023-01-02"),
      invitationAcceptedAt: new Date("2023-01-03"),
    });
    await companyContractorsFactory.create({ userId: contractorUser.id });

    const { company: secondCompany } = await companiesFactory.create({ name: "Second Company" });
    const { user: adminUser } = await usersFactory.create({ email: "admin@example.com" });
    await companyAdministratorsFactory.create({ companyId: secondCompany.id, userId: adminUser.id });

    await login(page, adminUser, "/people");
    await page.getByRole("button", { name: "Add contractor" }).click();

    await page.getByLabel("Email").fill(contractorUser.email);
    await fillDatePicker(page, "Start date", "08/08/2025");
    await page.getByLabel("Role").fill("Role");
    await page.getByRole("tab", { name: "Write" }).click();
    await findRichTextEditor(page, "Contract").fill("This is a contract you must sign");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await expect(page.getByRole("cell").filter({ hasText: "Alex" })).toBeVisible();

    await logout(page);
    await login(page, contractorUser);
    // Click company switcher in sidebar
    await page.locator('[data-slot="dropdown-menu-trigger"]').first().click();
    await page.getByRole("menuitem", { name: "Second Company" }).click();
    await expect(page.getByText("Second Company")).toBeVisible();
    await page.getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByText("You have an unsigned contract")).toBeVisible();
    await page.getByRole("link", { name: "sign it" }).click();

    await expect(page.getByText("This is a contract you must sign")).toBeVisible();
    await page.getByRole("button", { name: "Add your signature" }).click();
    await expect(page.getByText(assertDefined(contractorUser.legalName))).toBeVisible();
    await page.getByRole("button", { name: "Agree & Submit" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("You have an unsigned contract")).not.toBeVisible();
  });
});
