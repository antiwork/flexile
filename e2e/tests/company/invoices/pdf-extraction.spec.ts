import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { invoices } from "@/db/schema";

test.describe("invoice PDF extraction via dropzone", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let user: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.createCompletedOnboarding();
    user = (await usersFactory.create()).user;
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: user.id,
    });
  });

  async function createDataTransferHandle(page: Page, opts: { fileName: string; type: string; bytes: number[] }) {
    return page.evaluateHandle((opts) => {
      const { fileName, type, bytes } = opts;
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(bytes)], fileName, { type });
      dt.items.add(file);
      return dt;
    }, opts);
  }

  test("should handle drag and drop PDF extraction", async ({ page }) => {
    await login(page, user, "/invoices/new");
    await page.route("/api/invoices/extract-from-pdf", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            is_invoice: true,
            invoice: {
              invoice_date: "2024-02-20",
              invoice_number: "INV-DRAG-DROP-001",
              line_items: [
                {
                  description: "Backend Development",
                  quantity: "60",
                  pay_rate_in_subunits: 8000,
                  hourly: true,
                },
              ],
            },
          },
        }),
      });
    });

    const dropzoneTarget = page.locator("#dropzone");
    const dataTransfer = await createDataTransferHandle(page, {
      fileName: "invoice.pdf",
      type: "application/pdf",
      bytes: Array.from(Buffer.from("%PDF-1.4\nTest Invoice")),
    });
    await dropzoneTarget.dispatchEvent("dragenter", { dataTransfer });
    await expect(page.getByText("Drag your PDF here")).toBeVisible();
    await dropzoneTarget.dispatchEvent("drop", { dataTransfer });
    await expect(page.getByText("Drag your PDF here")).not.toBeVisible();
    await expect(page.getByLabel("Invoice ID")).toHaveValue("INV-DRAG-DROP-001");
    await expect(page.getByPlaceholder("Description").first()).toHaveValue("Backend Development");
    await expect(page.getByLabel("Hours / Qty").first()).toHaveValue("01:00");
    await expect(page.getByLabel("Rate").first()).toHaveValue("80");
    await page.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    const row = page
      .getByRole("row")
      .filter({ has: page.getByText("INV-DRAG-DROP-001") })
      .filter({
        has: page.getByText("$80"),
      })
      .filter({
        has: page.getByText("Awaiting approval"),
      });
    await expect(row).toBeVisible();
    const invoice = await db.query.invoices
      .findFirst({ where: eq(invoices.companyId, company.company.id), orderBy: desc(invoices.id) })
      .then(takeOrThrow);
    expect(invoice.invoiceNumber).toBe("INV-DRAG-DROP-001");
  });

  test("should not accept non-PDF files", async ({ page }) => {
    await login(page, user, "/invoices/new");
    const dropzoneTarget = page.locator("#dropzone");
    const dataTransfer = await createDataTransferHandle(page, {
      fileName: "document.txt",
      type: "text/plain",
      bytes: Array.from(Buffer.from("This is a text file, not a PDF")),
    });
    await dropzoneTarget.dispatchEvent("dragenter", { dataTransfer });
    await expect(page.getByText("Drag your PDF here")).not.toBeVisible();
  });
});
