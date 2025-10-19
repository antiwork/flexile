import { fillByLabel, fillDatePicker } from "@test/helpers";
import { expect, type Page } from "@test/index";

export type LineItem = { description: string; hoursOrQty: string };

export const createAndSendInvoice = async (
  page: Page,
  {
    invoiceId,
    date,
    items,
    notes,
    expectTotalText,
  }: {
    invoiceId: string;
    date: string;
    items: LineItem[];
    notes?: string;
    expectTotalText?: string;
  },
) => {
  await page.locator("header").getByRole("link", { name: "New invoice" }).click();
  await expect(page.getByRole("heading", { name: /invoice/iu })).toBeVisible();
  await page.getByLabel("Invoice ID").fill(invoiceId);
  await fillDatePicker(page, "Date", date);
  for (const [i, item] of items.entries()) {
    const { description, hoursOrQty } = item;
    if (i > 0) await page.getByRole("button", { name: "Add line item" }).click();
    await page.getByPlaceholder("Description").nth(i).fill(description);
    await fillByLabel(page, "Hours / Qty", hoursOrQty, { index: i });
  }
  if (notes) await page.getByPlaceholder("Enter notes about your").fill(notes);
  if (expectTotalText) await expect(page.getByText(expectTotalText, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send invoice" }).click();
};

export const openInvoiceEditById = async (page: Page, invoiceId: string) => {
  await page.getByRole("cell", { name: invoiceId }).click();
  await page.getByRole("link", { name: "Edit invoice" }).click();
  await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();
};
