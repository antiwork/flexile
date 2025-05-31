import { clerk } from "@clerk/testing/playwright";
import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal as mockDocusealHelper } from "@test/helpers/docuseal";
import { expect, type Page, test, withinModal } from "@test/index";
import { addMonths, formatISO } from "date-fns";
import { desc, eq } from "drizzle-orm";
import type { NextFixture } from "next/experimental/testmode/playwright";
import { companies, companyContractors, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("New Contractor", () => {
  let company: typeof companies.$inferSelect;
  let user: typeof users.$inferSelect;

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

    const userResult = await usersFactory.create();
    user = userResult.user;

    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });
  });

  const fillForm = async (page: Page) => {
    const email = faker.internet.email().toLowerCase();
    const date = addMonths(new Date(), 1);
    await login(page, user);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Invite contractor" }).click();
    await expect(page.getByText("Who's joining?")).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Start date").fill(formatISO(date, { representation: "date" }));
    return { email, date };
  };

  const getCreatedContractor = async () => {
    const contractor = assertDefined(
      await db.query.companyContractors.findFirst({
        with: { user: true },
        where: eq(companyContractors.companyId, company.id),
        orderBy: desc(companyContractors.createdAt),
      }),
    );
    return contractor;
  };

  const mockDocuseal = (next: NextFixture, companyValues: Record<string, unknown>) =>
    mockDocusealHelper(next, {
      submitters: async () => ({ "Company Representative": user, Signer: (await getCreatedContractor()).user }),
      validateValues: async (role, values) => {
        if (role === "Company Representative") {
          return expect(values).toMatchObject(companyValues);
        }
        const contractor = await getCreatedContractor();
        return expect(values).toMatchObject({
          __signerEmail: contractor.user.email,
          __signerName: contractor.user.legalName,
        });
      },
    });

  test("allows inviting a contractor", async ({ page, next }) => {
    const { mockForm } = mockDocuseal(next, {
      __payRate: "99 per hour",
      __role: "Hourly Role 1",
      __targetAnnualHours: "Target Annual Hours: 1,100",
      __maximumFee:
        'Maximum fee payable to Contractor on this Project Assignment, including all items in the first two paragraphs above is $152,460 (the "Maximum Fee").',
    });
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Hourly Role 1");
    await page.getByLabel("Average hours").fill("25");
    await page.getByLabel("Rate").fill("99");

    await mockForm(page);
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

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    await expect(row).toContainText("Hourly Role 1");
    await expect(row).toContainText("Invited");
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();

    await clerk.signOut({ page });
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);
    await page.getByRole("link", { name: "Review & sign" }).click();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("allows inviting a project-based contractor", async ({ page, next }) => {
    const { mockForm } = mockDocuseal(next, {
      __payRate: "1,000 per project",
      __role: "Project-based Role",
      __targetAnnualHours: "",
      __maximumFee: "",
    });
    await mockForm(page);
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Project-based Role");
    await page.getByLabel("Project-based").check({ force: true });
    await page.getByLabel("Rate").fill("1000");

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

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    await expect(row).toContainText("Project-based Role");
    await expect(row).toContainText("Invited");
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();

    await clerk.signOut({ page });
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);
    await page.getByRole("link", { name: "Review & sign" }).click();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("allows inviting a salary-based contractor", async ({ page }) => {
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Salaried Role");
    await page.getByLabel("Salary").check({ force: true });
    await page.getByLabel("Rate").fill("120000");

    await page.getByRole("button", { name: "Send invite" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    await expect(row).toContainText("Role");
    await expect(row).toContainText("Invited");

    await clerk.signOut({ page });
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("allows inviting a contractor with contract signed elsewhere", async ({ page }) => {
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Contract Signed Elsewhere Role");
    await page.getByLabel("Rate").fill("100");

    await page.getByLabel("Already signed contract elsewhere").check({ force: true });

    await page.getByRole("button", { name: "Send invite" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    await expect(row).toContainText("Contract Signed Elsewhere Role");
    await expect(row).toContainText("Invited");

    await clerk.signOut({ page });
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  // TODO: write these tests after the most important tests are done
  // TODO: write test - allows reactivating an alumni contractor
  // TODO: write test - excludes equity paragraphs when equity compensation is disabled
  // TODO: write test - includes equity paragraphs when equity compensation is enabled
  // TODO: write test - pre-fills form with last-used hourly contractor values
  // TODO: write test - pre-fills form with last-used project-based contractor values
  // TODO: write test - allows creating a new hourly role ad-hoc
  // TODO: write test - allows creating a new project-based role ad-hoc
});
