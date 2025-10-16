import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { invoiceLineItemsFactory } from "@test/factories/invoiceLineItems";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import type { Page } from "@test/index";
import { eq } from "drizzle-orm";
import { invoices, users } from "@/db/schema";

async function verifyLinksAndContent(
  page: Page,
  contentMap: Record<string, string[]>,
  { inNotes = false }: { inNotes?: boolean } = {},
) {
  const links = Object.keys(contentMap);
  const container = inNotes ? page.locator('footer:has-text("Notes")') : page.getByRole("table").getByRole("cell");

  for (const href of links) {
    const link = page.locator(`a[href="${href}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");

    const texts = contentMap[href] || [];
    for (const text of texts) {
      await expect(container.filter({ has: link }).getByText(text)).toBeVisible();
    }
  }

  const allLinks = page.locator('a[target="_blank"], a[href^="mailto:"]');
  await expect(allLinks).toHaveCount(links.length);
}

async function expectNoLinks(page: Page) {
  const links = page.locator('a[target="_blank"], a[href^="mailto:"]');
  await expect(links).toHaveCount(0);
}

test.describe("Automatic link detection in invoice content", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];
  let invoice: Awaited<ReturnType<typeof invoicesFactory.create>>["invoice"];
  let contractorUser: typeof users.$inferSelect;

  async function createLineItem(description: string) {
    await invoiceLineItemsFactory.create({ invoiceId: invoice.id, description });
  }

  async function setInvoiceNotes(notes: string) {
    await db.update(invoices).set({ notes }).where(eq(invoices.id, invoice.id));
  }

  async function loginToInvoice(page: Page, user: typeof users.$inferSelect) {
    await login(page, user, `/invoices/${invoice.externalId}`);
    await expect(page.getByRole("heading", { name: /Invoice/iu })).toBeVisible();
  }

  test.beforeEach(async () => {
    ({ company, adminUser } = await companiesFactory.createCompletedOnboarding({
      isTrusted: true,
      requiredInvoiceApprovalCount: 1,
    }));
    ({ user: contractorUser } = await usersFactory.create());
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
      id: contractorUser.id,
    });
    invoice = (await invoicesFactory.create({ companyId: company.id, companyContractorId: contractorUser.id })).invoice;
  });
  test("automatically converts URLs and emails to clickable links in line items", async ({ page }) => {
    await createLineItem(
      "Frontend development using https://react.dev/docs/getting-started and http://tailwindcss.com/docs/installation",
    );
    await createLineItem("Design mockups available at www.behance.net/project/12345-final-designs");
    await createLineItem(
      "See https://api-docs.example.com/v2/endpoints#authentication for details, contact support@example.com if needed.",
    );

    await loginToInvoice(page, adminUser);
    await verifyLinksAndContent(page, {
      "https://react.dev/docs/getting-started": ["Frontend development using"],
      "http://tailwindcss.com/docs/installation": ["and"],
      "https://www.behance.net/project/12345-final-designs": ["Design mockups available at"],
      "https://api-docs.example.com/v2/endpoints#authentication": ["See", "for details, contact"],
      "mailto:support@example.com": ["if needed."],
    });
  });

  test("does not autolink non-top-level domains to avoid false positives", async ({ page }) => {
    await createLineItem("Updated internal docs at company-docs.internal and emailed team@company.local about changes");
    await loginToInvoice(page, adminUser);

    await expect(
      page.getByText("Updated internal docs at company-docs.internal and emailed team@company.local about changes"),
    ).toBeVisible();
    await expectNoLinks(page);
  });

  test("handles URLs with various punctuation scenarios correctly", async ({ page }) => {
    await createLineItem(
      "Visit https://api.example.com/docs) and https://docs.example.com/guide, for more information!",
    );
    await createLineItem(
      "Check (https://docs.example.com/api) and [https://app.example.com/dashboard] {https://support.example.com/help} for details.",
    );

    await loginToInvoice(page, adminUser);
    await verifyLinksAndContent(page, {
      "https://api.example.com/docs": [")", "for more information!"],
      "https://docs.example.com/guide": [","],
      "https://docs.example.com/api": ["(", ")"],
      "https://app.example.com/dashboard": ["[", "]"],
      "https://support.example.com/help": ["{", "}", "for details."],
    });
  });

  test("maintains link functionality for contractor invoice views", async ({ page }) => {
    await createLineItem("Code review completed for https://gitlab.company.com/merge-requests/456");
    await loginToInvoice(page, contractorUser);
    await verifyLinksAndContent(page, {
      "https://gitlab.company.com/merge-requests/456": ["Code review completed for"],
    });
  });

  test("applies link detection to invoice notes section", async ({ page }) => {
    await setInvoiceNotes(
      "Reference documentation at https://docs.company.com/setup-guide or reach out to billing@company.com for questions. Check www.company.com/status for updates.",
    );
    await loginToInvoice(page, adminUser);

    await verifyLinksAndContent(
      page,
      {
        "https://docs.company.com/setup-guide": ["Reference documentation at"],
        "mailto:billing@company.com": ["or reach out to"],
        "https://www.company.com/status": ["for questions. Check"],
      },
      { inNotes: true },
    );
  });

  test("handles invoice content without any detectable links", async ({ page }) => {
    await setInvoiceNotes("Standard invoice processed successfully. No links detected.");
    await loginToInvoice(page, adminUser);

    await expect(page.getByText("Standard invoice processed successfully. No links detected.")).toBeVisible();
    await expectNoLinks(page);
  });
});
