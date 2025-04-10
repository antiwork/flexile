import { type Page } from "@playwright/test";
import { assert } from "@/utils/assert";

export const findTableRow = async (page: Page, columnValues: Record<string, string>) => {
  const rows = await page.locator("tbody tr").all();
  for (const row of rows) {
    let matchesAll = true;

    for (const [columnLabel, expectedValue] of Object.entries(columnValues)) {
      const headerCell = page.locator("th").filter({ hasText: columnLabel });
      const columnIndex = await headerCell.evaluate((el) => Array.from(el.parentElement?.children || []).indexOf(el));

      const cellText = await row.getByRole("cell").nth(columnIndex).textContent();
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
