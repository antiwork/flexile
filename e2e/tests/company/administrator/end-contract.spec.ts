import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { fillDatePicker, findRichTextEditor } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { addDays, addYears, format } from "date-fns";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assert, assertDefined } from "@/utils/assert";

test.describe("End contract", () => {
  test("allows admin to end contractor's contract", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
    });
    const contractor = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractor != null, "Contractor is required");
    assert(contractor.preferredName != null, "Contractor preferred name is required");

    await login(page, adminUser, "/people");
    await page.getByRole("link", { name: contractor.preferredName }).click();
    await page.getByRole("button", { name: "End contract" }).click();

    await expect(page.getByLabel("End date").first()).toHaveText(format(new Date(), "M/d/yyyy"));

    await page.getByRole("button", { name: "Yes, end contract" }).click();

    await expect(page.getByRole("row").getByText(`Ended on ${format(new Date(), "MMM d, yyyy")}`)).toBeVisible();
    await page.getByRole("link", { name: contractor.preferredName }).click();

    await expect(page.getByText(`Contract ended on ${format(new Date(), "MMM d, yyyy")}`)).toBeVisible();
    await expect(page.getByText("Alumni")).toBeVisible();
    await expect(page.getByRole("button", { name: "End contract" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).not.toBeVisible();

    // Re-invite
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Add contractor" }).click();
    await page.getByLabel("Email").fill(contractor.email);
    const startDate = addYears(new Date(), 1);
    await fillDatePicker(page, "Start date", format(startDate, "MM/dd/yyyy"));
    await page.getByRole("tab", { name: "Write" }).click();
    await findRichTextEditor(page, "Contract").fill("This is a contract you must sign");
    await page.getByRole("button", { name: "Send invite" }).click();

    await expect(
      page
        .getByRole("row")
        .filter({ hasText: contractor.preferredName })
        .filter({ hasText: `Starts on ${format(startDate, "MMM d, yyyy")}` }),
    ).toBeVisible();

    await logout(page);
    await login(page, contractor);
    await page.getByRole("link", { name: "sign it" }).click();
    await expect(page.getByText("This is a contract you must sign")).toBeVisible();
    await page.getByRole("button", { name: "Add your signature" }).click();
    await expect(page.getByText(assertDefined(contractor.legalName))).toBeVisible();
    await page.getByRole("button", { name: "Agree & Submit" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("allows admin to end contractor's contract in the future", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    await login(page, adminUser);

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
    });
    const contractor = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractor != null, "Contractor is required");
    assert(contractor.preferredName != null, "Contractor preferred name is required");

    const futureDate = addDays(new Date(), 30);

    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractor.preferredName }).click();
    await page.getByRole("button", { name: "End contract" }).click();

    await fillDatePicker(page, "End date", format(futureDate, "MM/dd/yyyy"));
    await page.getByRole("button", { name: "Yes, end contract" }).click();

    await page.getByRole("link", { name: contractor.preferredName }).click();
    await expect(page.getByText(`Contract ends on ${format(futureDate, "MMM d, yyyy")}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "End contract" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).not.toBeVisible();

    await page.getByRole("button", { name: "Cancel contract end" }).click();
    await page.getByRole("button", { name: "Yes, cancel contract end" }).click();

    await expect(page.getByText(`Contract ends on`)).not.toBeVisible();
    await expect(page.getByRole("button", { name: "End contract" })).toBeVisible();
  });

  test("displays consistent end date in Pacific Time timezone", async ({ browser }) => {
    const context = await browser.newContext({
      timezoneId: "America/Los_Angeles", // Pacific Time
      locale: "en-US",
    });
    const page = await context.newPage();

    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);

    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
    });
    const contractor = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractor != null, "Contractor is required");
    assert(contractor.preferredName != null, "Contractor preferred name is required");

    const endDate = new Date("2025-08-12");
    const expectedDisplay = format(endDate, "MMM d, yyyy");

    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("link", { name: contractor.preferredName }).click();
    await page.getByRole("button", { name: "End contract" }).click();

    await fillDatePicker(page, "End date", format(endDate, "MM/dd/yyyy"));
    await page.getByRole("button", { name: "Yes, end contract" }).click();

    // Verify date displays correctly in Pacific Time (should not shift to the previous day)
    await expect(page.getByRole("row").getByText(`Ended on ${expectedDisplay}`)).toBeVisible();
    await page.getByRole("link", { name: contractor.preferredName }).click();
    await expect(page.getByText(`Contract ended on ${expectedDisplay}`)).toBeVisible();

    await context.close();
  });
});
