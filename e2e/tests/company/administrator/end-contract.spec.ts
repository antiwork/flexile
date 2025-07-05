import { clerk } from "@clerk/testing/playwright";
import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { fillDatePicker } from "@test/helpers";
import { expect, test, withinModal } from "@test/index";
import { addDays, addYears, format } from "date-fns";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("End contract", () => {
  test("allows admin to end contractor's contract", async ({ page, next }) => {
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

    await page.getByRole("link", { name: "People" }).click();
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
    await page.getByRole("button", { name: "Invite contractor" }).click();
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": adminUser, Signer: contractor }),
    });
    await mockForm(page);
    await page.getByLabel("Email").fill(contractor.email);
    const startDate = addYears(new Date(), 1);
    await fillDatePicker(page, "Start date", format(startDate, "MM/dd/yyyy"));
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

    await expect(
      page
        .getByRole("row")
        .filter({ hasText: contractor.preferredName })
        .filter({ hasText: `Starts on ${format(startDate, "MMM d, yyyy")}` }),
    ).toBeVisible();

    await clerk.signOut({ page });
    await login(page, contractor);
    await page.getByRole("link", { name: "Review & sign" }).click();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();
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
});
