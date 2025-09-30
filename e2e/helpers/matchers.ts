import { type Page } from "@playwright/test";
import { assert } from "@/utils/assert";

export const findTableRow = async (page: Page, columnValues: Record<string, string>) => {
  const headerCells = page.locator("thead tr").last().locator("th");
  const headerTexts = await headerCells.allTextContents();

  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rows.nth(rowIndex);
    if (await row.isHidden()) {
      continue;
    }

    let matchesAll = true;

    for (const [columnLabel, expectedValue] of Object.entries(columnValues)) {
      const columnIndex = headerTexts.findIndex((text) => text.trim() === columnLabel);
      if (columnIndex === -1) {
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

  return null;
};

// TODO (techdebt) clean this up
export const findRequiredTableRow = async (...args: Parameters<typeof findTableRow>) => {
  const row = await findTableRow(...args);
  assert(row !== null);
  return row;
};
