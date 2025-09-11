import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { invoices } from "@/db/schema";

test.describe("invoice linkify", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = (
      await companiesFactory.createCompletedOnboarding({
        equityEnabled: true,
      })
    ).company;

    contractorUser = (await usersFactory.create()).user;

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
      payRateInSubunits: 6000,
      equityPercentage: 20,
    });
  });

  test("renders clickable links in notes with correct hrefs and punctuation handling", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    await page.getByPlaceholder("Description").fill("Initial work");
    await page.getByLabel("Hours / Qty").fill("01:00");

    const notes = "See https://example.com/docs). Also visit www.flexile.com, or email hi@example.com.";
    await page.getByPlaceholder("Enter notes about your invoice (optional)").fill(notes);

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    await page.goto(`/invoices/${invoice.externalId}`);

    const httpsLink = page.getByRole("link", { name: "https://example.com/docs" });
    await expect(httpsLink).toHaveAttribute("href", "https://example.com/docs");
    await expect(httpsLink).toHaveAttribute("target", "_blank");
    await expect(httpsLink).toHaveAttribute("rel", /noopener/u);

    const wwwLink = page.getByRole("link", { name: "www.flexile.com" });
    await expect(wwwLink).toHaveAttribute("href", "https://www.flexile.com");

    const emailLink = page.getByRole("link", { name: "hi@example.com" });
    await expect(emailLink).toHaveAttribute("href", "mailto:hi@example.com");
  });

  test("renders clickable links in line item descriptions and preserves text around them", async ({ page }) => {
    await login(page, contractorUser, "/invoices/new");

    const description = "Consulting: see www.example.org/test). Then follow-up";
    await page.getByPlaceholder("Description").fill(description);
    await page.getByLabel("Hours / Qty").fill("02:00");

    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);

    await page.goto(`/invoices/${invoice.externalId}`);

    const descLink = page.getByRole("link", { name: "www.example.org/test" });
    await expect(descLink).toHaveAttribute("href", "https://www.example.org/test");

    await expect(page.getByText("Then follow-up")).toBeVisible();
  });
});
