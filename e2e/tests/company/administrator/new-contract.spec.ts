import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, type Page, test, withinModal } from "@test/index";
import { addMonths, format } from "date-fns";
import { eq } from "drizzle-orm";
import { PayRateType } from "@/db/enums";
import { companies, users } from "@/db/schema";
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
    await page.getByRole("button", { name: "Add contractor" }).click();
    await expect(page.getByText("Who's joining?")).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await fillDatePicker(page, "Start date", format(date, "MM/dd/yyyy"));
    return { email, date };
  };

  test("allows inviting a contractor", async ({ page }) => {
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Hourly Role 1");
    await page.getByLabel("Rate").fill("99");

    await page.getByRole("tab", { name: "Write" }).click();
    await page.locator('input[type="text"][name="document-title"]').fill("Test Agreement");
    await page.locator('[contenteditable="true"]').last().fill("Test Agreement");

    await page.getByRole("button", { name: "Send invite" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("textbox", { name: "Signature" }).fill("Admin Admin");
        await modal.getByRole("button", { name: "Agree & Submit" }).click();
      },
      { page },
    );

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();

    await logout(page);
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);
    await page.getByRole("link", { name: "sign it" }).click();
    await page.getByRole("textbox", { name: "Signature" }).fill("Flexy Bob");
    await page.getByRole("button", { name: "Agree & Submit" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("allows inviting a project-based contractor", async ({ page }) => {
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Project-based Role");
    await page.getByRole("radio", { name: "Custom" }).click({ force: true });
    await page.getByLabel("Rate").fill("1000");
    await page.getByRole("tab", { name: "Write" }).click();
    await page.locator('input[type="text"][name="document-title"]').fill("Test Agreement");
    await page.locator('[contenteditable="true"]').last().fill("Test Agreement");

    await page.getByRole("button", { name: "Send invite" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("textbox", { name: "Signature" }).fill("Admin Admin");
        await modal.getByRole("button", { name: "Agree & Submit" }).click();
      },
      { page },
    );

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    await expect(row).toContainText("Project-based Role");
    await expect(row).toContainText("Invited");
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();

    await logout(page);
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);
    await page.getByRole("link", { name: "sign it" }).click();
    await page.getByRole("textbox", { name: "Signature" }).fill("Flexy Bob");
    await page.getByRole("button", { name: "Agree & Submit" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("allows inviting a contractor with contract signed elsewhere", async ({ page }) => {
    const { email } = await fillForm(page);
    await page.getByLabel("Role").fill("Contract Signed Elsewhere Role");

    await page.getByLabel("Already signed contract elsewhere").check({ force: true });

    await page.getByRole("button", { name: "Send invite" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText(email);
    await expect(row).toContainText("Contract Signed Elsewhere Role");
    await expect(row).toContainText("Invited");

    await logout(page);
    const [deletedUser] = await db.delete(users).where(eq(users.email, email)).returning();
    const { user: newUser } = await usersFactory.create({ id: assertDefined(deletedUser).id });
    await login(page, newUser);

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("pre-fills form with last contractor's values", async ({ page }) => {
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
      role: "Hourly Role 1",
      payRateInSubunits: 10000,
      payRateType: PayRateType.Custom,
      contractSignedElsewhere: true,
    });
    await login(page, user);
    await page.goto("/people");
    await page.getByRole("button", { name: "Add contractor" }).click();
    await expect(page.getByLabel("Role")).toHaveValue("Hourly Role 1");
    await expect(page.getByLabel("Rate")).toHaveValue("100");
    await expect(page.getByLabel("Already signed contract elsewhere")).toBeChecked();
    await expect(page.getByLabel("Custom")).toBeChecked();
  });

  // TODO: write these tests after the most important tests are done
  // TODO: write test - allows reactivating an alumni contractor
  // TODO: write test - excludes equity paragraphs when equity compensation is disabled
  test("allows adding a contractor with custom start date using date picker", async ({ page }) => {
    const workerEmail = faker.internet.email().toLowerCase();
    const targetDay = 15;
    const targetDate = new Date();
    targetDate.setDate(targetDay);

    await login(page, user);
    await page.goto("/people");
    await page.getByRole("button", { name: "Add contractor" }).click();

    await expect(page.getByText("Who's joining?")).toBeVisible();
    await page.getByLabel("Email").fill(workerEmail);

    // Test the actual date picker calendar interaction
    await page.getByRole("button", { name: "Calendar" }).click();

    // Wait for calendar to be visible
    await expect(page.getByRole("grid")).toBeVisible();

    // Click on the specific date
    await page.getByRole("gridcell", { name: targetDay.toString() }).first().click();

    // Verify the date was selected in the input
    await expect(page.getByRole("group", { name: "Start date" })).toContainText(targetDay.toString());
  });

  // TODO: write test - includes equity paragraphs when equity compensation is enabled
  // TODO: write test - pre-fills form with last-used hourly contractor values
  // TODO: write test - pre-fills form with last-used project-based contractor values
  // TODO: write test - allows creating a new hourly role ad-hoc
  // TODO: write test - allows creating a new project-based role ad-hoc
});
