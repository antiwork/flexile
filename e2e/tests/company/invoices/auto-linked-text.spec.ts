import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("AutoLinkedText URL functionality", () => {
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

  test("renders URLs as clickable links in invoice notes", async ({ page }) => {
    await login(page, contractorUser);

    // Create an invoice with URLs in the notes
    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Development work");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill("Visit https://example.com for more information.");
    await page.getByRole("button", { name: "Send invoice" }).click();

    // Navigate to the created invoice
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    // Verify the links are rendered correctly in notes
    const urlLink = page.locator('a[href="https://example.com"]');
    await expect(urlLink).toBeVisible();
    await expect(urlLink).toHaveText("https://example.com");
  });
});
