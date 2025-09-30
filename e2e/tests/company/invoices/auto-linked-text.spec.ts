import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("AutoLinkedText functionality", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>;
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.createCompletedOnboarding();
    contractorUser = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
      payRateInSubunits: 7500,
    });
  });

  test("renders URLs as clickable links in line item descriptions", async ({ page }) => {
    await login(page, contractorUser);

    // Create an invoice with a URL in the description
    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Check documentation at https://docs.example.com");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    // Navigate to the created invoice
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    // Verify the URL is rendered as a clickable link
    const urlLink = page.locator('a[href="https://docs.example.com"]');
    await expect(urlLink).toBeVisible();
    await expect(urlLink).toHaveText("https://docs.example.com");
    await expect(urlLink).toHaveAttribute("target", "_blank");
  });

  test("renders email addresses as clickable mailto links in line item descriptions", async ({ page }) => {
    await login(page, contractorUser);

    // Create an invoice with an email in the description
    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Contact support@example.com for questions");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    // Navigate to the created invoice
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    // Verify the email is rendered as a clickable mailto link
    const emailLink = page.locator('a[href="mailto:support@example.com"]');
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveText("support@example.com");
  });

  test("renders URLs and emails as clickable links in invoice notes", async ({ page }) => {
    await login(page, contractorUser);

    // Create an invoice with URLs and emails in the notes
    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Development work");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill("Visit https://example.com or contact admin@example.com for support.");
    await page.getByRole("button", { name: "Send invoice" }).click();

    // Navigate to the created invoice
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    // Verify the links are rendered correctly in notes
    const urlLink = page.locator('a[href="https://example.com"]');
    await expect(urlLink).toBeVisible();
    await expect(urlLink).toHaveText("https://example.com");

    const emailLink = page.locator('a[href="mailto:admin@example.com"]');
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveText("admin@example.com");
  });
});
