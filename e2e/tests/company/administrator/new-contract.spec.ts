import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyRolesFactory } from "@test/factories/companyRoles";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test, withinModal, withIsolatedBrowserSessionPage } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { companies, companyContractors, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("New Contractor", () => {
  let company: typeof companies.$inferSelect;
  let user: typeof users.$inferSelect;

  test.beforeEach(async () => {
    // Setup company and admin user
    const result = await companiesFactory.create({
      name: "Gumroad",
      streetAddress: "548 Market Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94104-5401",
      countryCode: "US",
    });
    company = result.company;

    const userResult = await usersFactory.create({
      legalName: "Sahil Lavingia",
      email: "sahil@example.com",
    });
    user = userResult.user;

    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });

    // Create roles
    await companyRolesFactory.create({ companyId: company.id, name: "Hourly Role 1" });
    await companyRolesFactory.createProjectBased({ companyId: company.id, name: "Project-based Role" });
    await companyRolesFactory.createSalaried({ companyId: company.id, name: "Salaried Role" });
    await Promise.all([
      companyRolesFactory.create({ companyId: company.id, name: "Hourly Role 2" }),
      companyRolesFactory.create({ companyId: company.id, name: "Hourly Role 3" }),
    ]);
  });

  const fillForm = async (
    page: Page,
    { projectBased = false, salaryBased = false, email = "flexy-bob@flexile.com" },
  ) => {
    await login(page, user);
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: "Invite contractor" }).click();
    await expect(page.getByText("Who's joining?")).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Start date").fill("2025-08-08");
    if (projectBased) {
      await page.getByLabel("Role").selectOption("Project-based Role");
    } else if (salaryBased) {
      await page.getByLabel("Role").selectOption("Salaried Role");
    } else {
      await page.getByLabel("Role").selectOption("Hourly Role 1");
      await page.getByLabel("Average hours").fill("25");
    }
    await page.getByLabel("Rate").fill(projectBased ? "1000" : salaryBased ? "120000" : "99");
  };

  test("allows inviting a contractor", async ({ page, browser, next }) => {
    next.onFetch(async (request) => {
      console.log(request.url);
      if (request.url === "https://api.docuseal.com/submissions/init") {
        const contractor = assertDefined(
          await db.query.companyContractors.findFirst({
            where: eq(companyContractors.companyId, company.id),
            orderBy: desc(companyContractors.createdAt),
          }),
        );
        expect(await request.json()).toEqual({
          template_id: 695987,
          send_email: false,
          submitters: [
            { email: user.email, role: "Company Representative", external_id: user.id.toString() },
            { email: "flexy-bob@flexile.com", role: "Signer", external_id: contractor.userId.toString() },
          ],
        });
        return Response.json({ id: 1 });
      } else if (request.url === "https://api.docuseal.com/submissions/1") {
        return Response.json({
          submitters: [
            { id: 1, external_id: "1", role: "Company Representative", status: "awaiting" },
            { id: 2, external_id: "2", role: "Signer", status: "awaiting" },
          ],
        });
      } else if (request.url === "https://api.docuseal.com/submitters/1") {
        expect(await request.json()).toMatchObject({
          values: {
            __payRate: "99 per hour",
            __role: "Hourly Role 1",
            __targetAnnualHours: "Target Annual Hours: 1,100",
            __maximumFee:
              'Maximum fee payable to Contractor on this Project Assignment, including all items in the first two paragraphs above is $152,460 (the "Maximum Fee").',
          },
        });
        return new Response();
      } else if (request.url === "https://api.docuseal.com/submitters/2") {
        const contractor = assertDefined(
          await db.query.companyContractors.findFirst({
            with: { user: true },
            where: eq(companyContractors.companyId, company.id),
            orderBy: desc(companyContractors.createdAt),
          }),
        );
        expect(await request.json()).toMatchObject({
          values: { __signerEmail: contractor.user.email, __signerName: contractor.user.legalName },
        });
        return new Response();
      } else if (request.url === "https://docuseal.com/embed/forms") {
        return Response.json({
          template: {},
          submitter: { id: 1, email: user.email, uuid: "1" },
          submission: {
            template_schema: [],
            template_submitters: [],
            template_fields: [{ submitter_uuid: "1", type: "signature" }],
          },
        });
      }
      return "continue" as const;
    });
    await fillForm(page, {});

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

    const row = page.getByRole("row").filter({ hasText: "flexy-bob@flexile.com" });
    await expect(row).toContainText("flexy-bob@flexile.com");
    await expect(row).toContainText("Aug 8, 2025");
    await expect(row).toContainText("Hourly Role 1");
    await expect(row).toContainText("Invited");
    const [deletedUser] = await db.delete(users).where(eq(users.email, "flexy-bob@flexile.com")).returning();

    await withIsolatedBrowserSessionPage(
      async (isolatedPage) => {
        const { user } = await usersFactory.create({ id: assertDefined(deletedUser).id });
        await login(isolatedPage, user);
        await isolatedPage.getByRole("link", { name: "Review & sign" }).click();
        await isolatedPage.getByRole("button", { name: "Sign now" }).click();
        await isolatedPage.getByRole("link", { name: "Type" }).click();
        await isolatedPage.getByPlaceholder("Type signature here...").fill("Flexy Bob");
        await isolatedPage.getByRole("button", { name: "Complete" }).click();
        await expect(isolatedPage.getByRole("heading", { name: "Invoicing" })).toBeVisible();
      },
      { browser },
    );
  });

  test("allows inviting a project-based contractor", async ({ page, browser }) => {
    await fillForm(page, { projectBased: true });

    await page.getByRole("button", { name: "Send invite" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.getByText("Project-based Role").first()).toBeVisible();
        await expect(modal.getByText("1,000 per project")).toBeVisible();
        await expect(modal.getByText("Target annual hours")).not.toBeVisible();
        await expect(modal.getByText("Maximum fee payable")).not.toBeVisible();
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Next" }).click();
        await expect(modal.getByPlaceholder("Type here...")).toHaveValue("Chief Executive Officer");
        await modal.getByRole("button", { name: "Complete" }).click();
      },
      { page },
    );

    const row = page.getByRole("row").filter({ hasText: "flexy-bob@flexile.com" });
    await expect(row).toContainText("flexy-bob@flexile.com");
    await expect(row).toContainText("Aug 8, 2025");
    await expect(row).toContainText("Project-based Role");
    await expect(row).toContainText("Invited");
    const [deletedUser] = await db.delete(users).where(eq(users.email, "flexy-bob@flexile.com")).returning();

    await withIsolatedBrowserSessionPage(
      async (isolatedPage) => {
        const { user } = await usersFactory.create({ id: assertDefined(deletedUser).id });
        await login(isolatedPage, user);
        await isolatedPage.getByRole("link", { name: "Review & sign" }).click();
        await expect(isolatedPage.getByText("Project-based Role").first()).toBeVisible();
        await expect(isolatedPage.getByText("1,000 per project")).toBeVisible();
        await expect(isolatedPage.getByText(user.email, { exact: true }).first()).toBeVisible();
        await expect(isolatedPage.getByText(user.legalName ?? "").first()).toBeVisible();
        await isolatedPage.getByRole("button", { name: "Sign now" }).click();
        await isolatedPage.getByRole("link", { name: "Type" }).click();
        await isolatedPage.getByPlaceholder("Type signature here...").fill("Flexy Bob");
        await isolatedPage.getByRole("button", { name: "Next" }).click();
        await isolatedPage.getByPlaceholder("Type here...").fill("50");
        await isolatedPage.getByRole("button", { name: "Complete" }).click();
        await expect(isolatedPage.getByRole("heading", { name: "Invoicing" })).toBeVisible();
      },
      { browser },
    );
  });

  test("allows inviting a salary-based contractor", async ({ page }) => {
    await fillForm(page, { salaryBased: true });

    await page.getByRole("button", { name: "Send invite" }).click();

    const row = page.getByRole("row").filter({ hasText: "flexy-bob@flexile.com" });
    await expect(row).toContainText("flexy-bob@flexile.com");
    await expect(row).toContainText("Aug 8, 2025");
    await expect(row).toContainText("Role");
    await expect(row).toContainText("Invited");
  });

  // TODO: write these tests after the most important tests are done
  // TODO: write test - allows inviting a contractor and skipping trials if work trials are enabled
  // TODO: write test - allows reactivating an alumni contractor
  // TODO: write test - excludes equity paragraphs when equity compensation is disabled
  // TODO: write test - includes equity paragraphs when equity compensation is enabled
  // TODO: write test - pre-fills form with last-used hourly contractor values
  // TODO: write test - pre-fills form with last-used project-based contractor values
  // TODO: write test - allows creating a new hourly role ad-hoc
  // TODO: write test - allows creating a new project-based role ad-hoc
});
