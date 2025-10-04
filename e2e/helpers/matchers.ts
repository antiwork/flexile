import { type Locator, type Page } from "@playwright/test";

const REGEX_SPECIAL_CHARACTERS = new Set(["\\", ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
const escapeForRegex = (value: string) =>
  value
    .split("")
    .map((char) => (REGEX_SPECIAL_CHARACTERS.has(char) ? `\\${char}` : char))
    .join("");

export const findTableRow = (page: Page, columnValues: Record<string, string>): Locator => {
  const rows = page.locator("tbody tr:not([hidden])");
  const cellLocator = page.locator("tbody tr td");

  let matchingRows = rows;

  for (const [columnLabel, expectedValue] of Object.entries(columnValues)) {
    const trimmedValue = expectedValue.trim();
    if (!trimmedValue) {
      continue;
    }

    const columnLabelLocator = page.locator("div[aria-hidden]", { hasText: columnLabel });
    const valueMatcher = new RegExp(escapeForRegex(trimmedValue), "iu");

    const cellInColumn = cellLocator.filter({ has: columnLabelLocator }).filter({ hasText: valueMatcher });

    matchingRows = matchingRows.filter({ has: cellInColumn });
  }

  return matchingRows.first();
};
