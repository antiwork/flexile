import { expect, type Locator, type Page } from "@playwright/test";

export const findTableRow = async (page: Page, columnValues: Record<string, string | RegExp>): Promise<Locator> => {
  const headerRow = page.getByRole("row").first();
  const headerRowByColumnNames = Object.entries(columnValues).reduce(
    (rowLocator, [columnLabel]) =>
      rowLocator.filter({
        has: page.getByRole("columnheader", { name: columnLabel }),
      }),
    headerRow,
  );
  await expect(headerRowByColumnNames).toBeVisible();

  const allHeaderTextToIndex = (await headerRow.getByRole("columnheader").allTextContents()).reduce<
    Map<string, number>
  >((mappings, text, index) => {
    const trimmedText = text.trim();
    if (trimmedText) mappings.set(trimmedText, index);
    return mappings;
  }, new Map());

  return Object.entries(columnValues).reduce((rows, [columnLabel, expectedValue]) => {
    const columnIndex = allHeaderTextToIndex.get(columnLabel);
    return rows.filter({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- await expect(headerRowByColumnNames).toBeVisible(); guarantees this never happen
      has: page.locator(`td:nth-child(${columnIndex! + 1})`, { hasText: expectedValue }),
    });
  }, page.locator("tbody tr"));
};
