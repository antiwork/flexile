import { expect, type Locator, type Page } from "@playwright/test";
import { assert } from "@/utils/assert";

export const findTableRow = async (page: Page, columnValues: Record<string, string>): Promise<Locator> => {
  const headerRow = page.getByRole("row").first();
  await expect(headerRow).toBeVisible();
  const allHeaderTexts = await headerRow.getByRole("columnheader").allTextContents();

  const allHeaderTextToIndex = allHeaderTexts.reduce<Record<string, number>>((map, text, index) => {
    const trimmedText = text.trim();
    if (trimmedText) {
      map[trimmedText] = index;
    }
    return map;
  }, {});

  const columnIndexes = Object.keys(columnValues).reduce<Record<string, number>>((result, label) => {
    const index = allHeaderTextToIndex[label];
    assert(index !== undefined, `Could not find column header "${label}" in table.`);
    result[label] = index;
    return result;
  }, {});

  return Object.entries(columnValues).reduce(
    (rows, [columnLabel, expectedValue]) =>
      rows.filter({
        has: page.locator(`td:nth-child(${(columnIndexes[columnLabel] ?? 0) + 1})`, { hasText: expectedValue }),
      }),
    page.locator("tbody tr"),
  );
};
