import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoiceLineItemsFactory } from "@test/factories/invoiceLineItems";
import { invoicesFactory } from "@test/factories/invoices";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assert } from "@/utils/assert";

const setupCompanyWithInvoice = async () => {
  const { company } = await companiesFactory.create({ isTrusted: true, requiredInvoiceApprovalCount: 1 });
  const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
  const user = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) });
  assert(user !== undefined);

  const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });
  const { invoice } = await invoicesFactory.create({
    companyId: company.id,
    companyContractorId: companyContractor.id,
  });

  return { company, user, invoice };
};

test.describe("Invoice line item clickable links", () => {
  test("converts URLs to clickable links with proper attributes", async ({ page }) => {
    const { user, invoice } = await setupCompanyWithInvoice();
    await invoiceLineItemsFactory.create({
      invoiceId: invoice.id,
      description: "Work on https://github.com/company/project/pull/123 and http://docs.example.com/api",
    });

    await invoiceLineItemsFactory.create({
      invoiceId: invoice.id,
      description: "www.figma.com/design review completed",
    });

    await login(page, user);
    await page.goto(`/invoices/${invoice.id}`);
    await expect(page.getByRole("heading", { name: /Invoice/iu })).toBeVisible();

    const githubLink = page.getByRole("link", { name: "https://github.com/company/project/pull/123" });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute("href", "https://github.com/company/project/pull/123");
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");

    const docsLink = page.getByRole("link", { name: "http://docs.example.com/api" });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "http://docs.example.com/api");

    const figmaLink = page.getByRole("link", { name: "www.figma.com/design" });
    await expect(figmaLink).toBeVisible();
    await expect(figmaLink).toHaveAttribute("href", "https://www.figma.com/design");

    await expect(page.getByText("Work on")).toBeVisible();
    await expect(page.getByText("and")).toBeVisible();
    await expect(page.getByText("review completed")).toBeVisible();
  });

  test("handles complex URLs and trailing punctuation correctly", async ({ page }) => {
    const { invoice, user } = await setupCompanyWithInvoice();
    await invoiceLineItemsFactory.create({
      invoiceId: invoice.id,
      description: "Check https://app.example.com/dashboard?id=123&view=weekly#section, and www.docs.com!",
    });

    await login(page, user);
    await page.goto(`/invoices/${invoice.id}`);
    await expect(page.getByRole("heading", { name: /Invoice/iu })).toBeVisible();

    const complexLink = page.getByRole("link", {
      name: "https://app.example.com/dashboard?id=123&view=weekly#section",
    });
    await expect(complexLink).toBeVisible();
    await expect(complexLink).toHaveAttribute("href", "https://app.example.com/dashboard?id=123&view=weekly#section");

    const docsLink = page.getByRole("link", { name: "www.docs.com" });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "https://www.docs.com");

    await expect(page.getByText("!")).toBeVisible();
  });

  test("does not linkify bare domains without protocol", async ({ page }) => {
    const { user, invoice } = await setupCompanyWithInvoice();
    await invoiceLineItemsFactory.create({
      invoiceId: invoice.id,
      description: "Updated example.com documentation and sent email to user@example.com",
    });

    await login(page, user);
    await page.goto(`/invoices/${invoice.id}`);
    await expect(page.getByRole("heading", { name: /Invoice/iu })).toBeVisible();

    await expect(page.getByText("Updated example.com documentation and sent email to user@example.com")).toBeVisible();

    const links = page.locator('a[target="_blank"][rel="noopener noreferrer"]');
    await expect(links).toHaveCount(0);
  });

  test("renders links for contractor viewing their own invoice", async ({ page }) => {
    const { company } = await setupCompanyWithInvoice();
    const { companyContractor } = await companyContractorsFactory.create({ companyId: company.id });

    const contractorUser = await db.query.users.findFirst({
      where: eq(users.id, companyContractor.userId),
    });
    assert(contractorUser !== undefined);

    const { invoice } = await invoicesFactory.create({
      companyId: company.id,
      companyContractorId: companyContractor.id,
    });

    await invoiceLineItemsFactory.create({
      invoiceId: invoice.id,
      description: "Completed tasks at https://project.example.com/tasks",
    });

    await login(page, contractorUser);
    await page.goto(`/invoices/${invoice.id}`);

    await expect(page.getByRole("heading", { name: /Invoice/iu })).toBeVisible();

    const link = page.getByRole("link", { name: "https://project.example.com/tasks" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://project.example.com/tasks");
    await expect(link).toHaveAttribute("target", "_blank");
  });
});
