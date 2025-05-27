import { clerk } from "@clerk/testing/playwright";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, withinModal } from "@test/index";

test.describe("Contractor for multiple companies", () => {
  test("contractor accepts invitation from second company and signs contract", async ({ page, next }) => {
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
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": adminUser, Signer: contractorUser }),
    });
    await mockForm(page);

    await login(page, adminUser);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: "Invite contractor" }).click();

    await page.getByLabel("Email").fill(contractorUser.email);
    await page.getByLabel("Start date").fill("2025-08-08");
    await page.getByLabel("Average hours").fill("25");
    await page.getByLabel("Rate").fill("110");
    await page.getByLabel("Role").fill("Role");
    await page.getByRole("button", { name: "Send invite" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Complete" }).click();
      },
      { page },
    );
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await expect(page.getByRole("cell").filter({ hasText: "Alex" })).toBeVisible();

    await clerk.signOut({ page });
    await login(page, contractorUser);
    await page.getByRole("button", { name: "Switch company" }).click();
    await page.getByRole("menuitem", { name: "Second Company" }).click();
    await page.getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByText("You have an unsigned contract")).toBeVisible();
    await page.getByRole("link", { name: "Review & sign" }).click();

    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("You have an unsigned contract")).not.toBeVisible();
  });
});
