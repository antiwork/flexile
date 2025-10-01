import { type Locator, type Page } from "@playwright/test";

const EMPTY_ROW_FILTER = "__FLEXILE_TABLE_ROW_NOT_FOUND__";

export const findTableRow = async (page: Page, columnValues: Record<string, string>): Promise<Locator> => {
  const headerCells = page.locator("thead tr").last().locator("th");
  const headerTexts = await headerCells.allTextContents();
  const headerLookup = new Map(headerTexts.map((text, index) => [text.trim(), index] as const));

  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rows.nth(rowIndex);
    if (await row.isHidden()) {
      continue;
    }

    let matchesAll = true;

    for (const [columnLabel, expectedValue] of Object.entries(columnValues)) {
      const columnIndex = headerLookup.get(columnLabel);
      if (columnIndex === undefined) {
        matchesAll = false;
        break;
      }

      const cells = row.getByRole("cell");
      const cellCount = await cells.count();

      if (cellCount <= columnIndex) {
        matchesAll = false;
        break;
      }

      const cellText = await cells.nth(columnIndex).textContent();
      if (!cellText?.includes(expectedValue)) {
        matchesAll = false;
        break;
      }
    }

    if (matchesAll) {
      return row;
    }
  }

  return page.locator("tbody tr").filter({ hasText: EMPTY_ROW_FILTER });
};
