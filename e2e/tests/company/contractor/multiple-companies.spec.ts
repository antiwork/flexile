import { clerk } from "@clerk/testing/playwright";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyRolesFactory } from "@test/factories/companyRoles";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assert, assertDefined } from "@/utils/assert";

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
    await companyRolesFactory.create({ companyId: secondCompany.id, activelyHiring: true });
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
    await page.getByRole("navigation").getByText("Second Company").click();
    await page.getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByText("You have an unsigned contract")).toBeVisible();
    await page.getByRole("link", { name: "Review & sign" }).click();

    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();

    await expect(page.getByRole("heading", { name: "Invoicing" })).toBeVisible();
    await expect(page.getByText("You have an unsigned contract")).not.toBeVisible();
  });

  test("contractor invites a company", async ({ page, next }) => {
    const { user } = await usersFactory.create({ invitingCompany: true });
    const { mockForm } = mockDocuseal(next, {
      submitters: async () => ({
        "Company Representative": assertDefined(
          await db.query.users.findFirst({ where: eq(users.email, "test+clerk_test@example.com") }),
        ),
        Signer: user,
      }),
    });
    await mockForm(page);

    await login(page, user);
    await page.getByRole("link", { name: "Invite companies" }).click();
    await page.getByRole("link", { name: "Invite company" }).click();

    await page.getByLabel("Email").fill("test+clerk_test@example.com");
    await page.getByLabel("Company name").fill("Test Company");
    await page.getByLabel("Role name").fill("Person");
    await page.getByLabel("Average hours").fill("25");
    await page.getByLabel("Rate").fill("110");
    await page.getByRole("button", { name: "Send invite" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Flexy Bob");
        await modal.getByRole("button", { name: "Complete" }).click();
      },
      { page },
    );
    await expect(page.getByRole("row").filter({ hasText: "Test Company" })).toBeVisible();
    const adminUser = await db.query.users.findFirst({
      where: eq(users.email, "test+clerk_test@example.com"),
      with: { companyAdministrators: { with: { company: true } } },
    });
    const company = adminUser?.companyAdministrators[0]?.company;
    assert(adminUser != null && company != null);

    await clerk.signOut({ page });
    await login(page, adminUser);
    await page.goto(`/companies/${company.externalId}/administrator/onboarding/details`);
    await page.getByLabel("Your full legal name").fill("Admin Admin");
    await page.getByLabel("Your company's legal name").fill("Test Company");
    await page.getByLabel("Street address, apt number").fill("123 Main St");
    await page.getByLabel("City").fill("Anytown");
    await selectComboboxOption(page, "State", "Missouri");
    await page.getByLabel("ZIP code").fill("12345");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Start using Flexile" })).toBeDisabled();

    const stripeFrame = page.frameLocator("[src^='https://js.stripe.com/v3/elements-inner-payment']");
    await stripeFrame.getByLabel("Test Institution").click();

    const bankFrame = page.frameLocator("[src^='https://js.stripe.com/v3/linked-accounts-inner']");
    await bankFrame.getByRole("button", { name: "Agree" }).click();
    await bankFrame.getByTestId("success").click();
    await bankFrame.getByRole("button", { name: "Connect account" }).click();
    await bankFrame.getByRole("button", { name: "Back to Flexile" }).click();

    await page.getByRole("button", { name: "Start using Flexile" }).click();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Admin Admin");
    await page.getByRole("button", { name: "Complete" }).click();

    await expect(page.getByRole("cell", { name: "Signed" })).toBeVisible();
  });
});
