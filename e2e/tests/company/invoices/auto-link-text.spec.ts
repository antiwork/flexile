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

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Check documentation at https://docs.example.com");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const urlLink = page.locator('a[href="https://docs.example.com"]');
    await expect(urlLink).toBeVisible();
    await expect(urlLink).toHaveText("https://docs.example.com");
    await expect(urlLink).toHaveAttribute("target", "_blank");
  });

  test("renders URLs as clickable links in invoice notes", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Development work");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page
      .getByPlaceholder("Enter notes about your invoice (optional)")
      .fill("Visit https://example.com for more information.");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const urlLink = page.locator('a[href="https://example.com"]');
    await expect(urlLink).toBeVisible();
    await expect(urlLink).toHaveText("https://example.com");
  });

  test("converts bare domains like x.com to clickable links", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Follow us on x.com and github.com for updates");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const xLink = page.locator('a[href="https://x.com"]');
    const githubLink = page.locator('a[href="https://github.com"]');

    await expect(xLink).toBeVisible();
    await expect(xLink).toHaveText("x.com");
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveText("github.com");
  });

  test("handles www domains correctly", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Visit www.example.com and www.github.com");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const exampleLink = page.locator('a[href="https://www.example.com"]');
    const githubLink = page.locator('a[href="https://www.github.com"]');

    await expect(exampleLink).toBeVisible();
    await expect(exampleLink).toHaveText("www.example.com");
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveText("www.github.com");
  });

  test("handles multiple URLs in the same description", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("Check https://docs.example.com, visit x.com, and see www.github.com");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const docsLink = page.locator('a[href="https://docs.example.com"]');
    const xLink = page.locator('a[href="https://x.com"]');
    const githubLink = page.locator('a[href="https://www.github.com"]');

    await expect(docsLink).toBeVisible();
    await expect(xLink).toBeVisible();
    await expect(githubLink).toBeVisible();
  });

  test("handles URLs with query parameters and fragments", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("Check https://example.com/path?param=value#section and x.com/path?query=test");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const complexLink = page.locator('a[href="https://example.com/path?param=value#section"]');
    const xComplexLink = page.locator('a[href="https://x.com/path?query=test"]');

    await expect(complexLink).toBeVisible();
    await expect(xComplexLink).toBeVisible();
  });

  test("handles HTTP and HTTPS URLs", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("Secure site: https://secure.example.com, legacy: http://legacy.example.com");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const httpsLink = page.locator('a[href="https://secure.example.com"]');
    const httpLink = page.locator('a[href="http://legacy.example.com"]');

    await expect(httpsLink).toBeVisible();
    await expect(httpLink).toBeVisible();
  });

  test("maintains proper link styling", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Visit https://example.com for details");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const link = page.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveClass(/text-blue-600/u);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("does not break existing text formatting", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("Development work for project. See https://github.com/repo for code. Contact: x.com/username");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const description = page.locator('[data-testid="line-item-description"]');
    await expect(description).toContainText("Development work for project");
    await expect(description).toContainText("Contact:");

    const githubLink = page.locator('a[href="https://github.com/repo"]');
    const xLink = page.locator('a[href="https://x.com/username"]');

    await expect(githubLink).toBeVisible();
    await expect(xLink).toBeVisible();
  });

  test("handles edge cases with special characters", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("API docs: https://api.example.com/v1/docs?version=2.0&format=json#authentication");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const apiLink = page.locator('a[href="https://api.example.com/v1/docs?version=2.0&format=json#authentication"]');
    await expect(apiLink).toBeVisible();
    await expect(apiLink).toHaveText("https://api.example.com/v1/docs?version=2.0&format=json#authentication");
  });

  test("works with different domain extensions", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Check example.org, test.co.uk, and demo.io for resources");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const orgLink = page.locator('a[href="https://example.org"]');
    const coUkLink = page.locator('a[href="https://test.co.uk"]');
    const ioLink = page.locator('a[href="https://demo.io"]');

    await expect(orgLink).toBeVisible();
    await expect(coUkLink).toBeVisible();
    await expect(ioLink).toBeVisible();
  });

  test("trims whitespace by default", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("   Check   https://example.com   for details   \n\n   Visit   x.com   for more info   ");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const exampleLink = page.locator('a[href="https://example.com"]');
    const xLink = page.locator('a[href="https://x.com"]');

    await expect(exampleLink).toBeVisible();
    await expect(xLink).toBeVisible();
  });

  test("handles text with leading and trailing whitespace", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("   Development work at https://github.com/repo   ");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const githubLink = page.locator('a[href="https://github.com/repo"]');
    await expect(githubLink).toBeVisible();
  });

  test("handles text with multiple consecutive spaces", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page.getByPlaceholder("Description").fill("Visit    https://example.com    for    information");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const exampleLink = page.locator('a[href="https://example.com"]');
    await expect(exampleLink).toBeVisible();
  });

  test("handles text with tabs and newlines", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("Project details:\n\t- Check https://docs.example.com\n\t- Visit x.com for updates");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const docsLink = page.locator('a[href="https://docs.example.com"]');
    const xLink = page.locator('a[href="https://x.com"]');

    await expect(docsLink).toBeVisible();
    await expect(xLink).toBeVisible();
  });

  test("handles mixed whitespace with URLs", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill("   \n\n  Development   \n\n  at https://github.com/project   \n\n  and https://x.com/updates   \n\n  ");
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const githubLink = page.locator('a[href="https://github.com/project"]');
    const xLink = page.locator('a[href="https://x.com/updates"]');

    await expect(githubLink).toBeVisible();
    await expect(xLink).toBeVisible();
  });

  test("verifies whitespace trimming actually works", async ({ page }) => {
    await login(page, contractorUser);

    await page.goto("/invoices/new");
    await page
      .getByPlaceholder("Description")
      .fill(
        "    \n\n\n    Development    \n\n\n    work    \n\n\n    at    \n\n\n    https://example.com    \n\n\n    ",
      );
    await page.getByLabel("Hours / Qty").fill("1:00");
    await page.getByRole("button", { name: "Send invoice" }).click();

    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await page.locator("tbody tr").first().click();

    const exampleLink = page.locator('a[href="https://example.com"]');
    await expect(exampleLink).toBeVisible();

    const descriptionElement = page.locator('[data-testid="line-item-description"]');
    const textContent = await descriptionElement.textContent();

    expect(textContent).not.toMatch(/\s{3,}/u);
    expect(textContent).not.toMatch(/\n{2,}/u);
  });
});
